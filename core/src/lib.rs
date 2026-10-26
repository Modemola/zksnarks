//! Shielded payment receipts for Zcash.
//!
//! A receipt proves one shielded output of one transaction: who it paid (the
//! recipient's shielded address), how much, and its memo. It reveals nothing
//! about any other output, and nothing that would let anyone follow the funds.
//!
//! How it works. An Orchard or Ironwood note is fixed by its recipient, value,
//! `rho` and `rseed`. `rho` is public on chain (the action's nullifier), so a
//! receipt carries the other three. From them the checker derives the note's
//! ephemeral secret (ZIP 212), which decrypts exactly that one output. The
//! decryption only succeeds if the rebuilt note matches the output's on-chain
//! commitment (`cmx`) and ephemeral key, so a receipt cannot lie about the
//! amount, the recipient or the memo.
//!
//! Disclosing `rseed` does not reveal the note's nullifier (that needs the
//! recipient's nullifier key), so a receipt cannot be used to see when or
//! whether the funds were spent.
//!
//! The receipt also carries the raw transaction. The checker recomputes the
//! transaction ID locally (ZIP 244), so the only thing left to confirm on
//! chain is that this ID was mined at the stated height.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use orchard::{
    keys::{FullViewingKey, Scope},
    note::{RandomSeed, Rho},
    note_encryption::{DomainVersion, NoteEncryptionDomain},
    value::NoteValue,
    Action, Address, Note, NoteVersion,
};
use zcash_address::unified::{self, Container, Encoding};
use zcash_note_encryption::{
    try_note_decryption, try_output_recovery_with_ovk, try_output_recovery_with_pkd_esk, Domain,
};
use zcash_primitives::transaction::Transaction;
use zcash_protocol::consensus::{BlockHeight, BranchId, Network, NetworkType};

#[cfg(target_arch = "wasm32")]
mod wasm;

/// Prefix of an encoded receipt, so a receipt is recognisable in a link or a file.
pub const PREFIX: &str = "zr1";
const FORMAT_VERSION: u8 = 1;

/// Errors, worded for the person reading the result.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum Error {
    #[error("This is not a receipt. Receipts start with \"zr1\".")]
    NotAReceipt,
    #[error("This receipt is damaged or incomplete. Ask for it to be sent again.")]
    Malformed,
    #[error("This receipt was made by a newer version. Update and try again.")]
    UnknownVersion,
    #[error("The transaction inside the receipt could not be read.")]
    BadTransaction,
    #[error("The transaction has no {0} payments.")]
    NoBundle(&'static str),
    #[error("The receipt points at payment {0}, which this transaction does not have.")]
    NoSuchOutput(usize),
    #[error("The receipt does not match the payment on chain. It may have been altered.")]
    Mismatch,
    #[error("That is not a viewing key this tool can read. Use a unified full viewing key (uview… or uviewtest…).")]
    BadViewingKey,
    #[error(
        "The viewing key has no Orchard part, so it cannot find Orchard or Ironwood payments."
    )]
    NoOrchardKey,
    #[error("The viewing key is for {0}, but the transaction is on {1}.")]
    WrongNetwork(&'static str, &'static str),
}

/// The shielded pool an output lives in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Pool {
    /// Orchard: today's mainnet pool.
    Orchard,
    /// Ironwood: the pool that takes new payments from NU7 on.
    Ironwood,
}

impl Pool {
    pub fn name(self) -> &'static str {
        match self {
            Pool::Orchard => "Orchard",
            Pool::Ironwood => "Ironwood",
        }
    }
    fn note_version(self) -> NoteVersion {
        match self {
            Pool::Orchard => NoteVersion::V2,
            Pool::Ironwood => NoteVersion::V3,
        }
    }
    fn to_byte(self) -> u8 {
        self as u8
    }
    fn from_byte(b: u8) -> Option<Self> {
        match b {
            0 => Some(Pool::Orchard),
            1 => Some(Pool::Ironwood),
            _ => None,
        }
    }
}

pub fn network_name(n: NetworkType) -> &'static str {
    match n {
        NetworkType::Main => "mainnet",
        NetworkType::Test => "testnet",
        NetworkType::Regtest => "regtest",
    }
}

fn params(n: NetworkType) -> Network {
    match n {
        NetworkType::Main => Network::MainNetwork,
        _ => Network::TestNetwork,
    }
}

/// Everything needed to check one payment.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub network: NetworkType,
    pub pool: Pool,
    /// Height of the block that mined the transaction.
    pub height: u32,
    /// Index of the output (action) within the pool's bundle.
    pub action_index: u16,
    /// Raw Orchard address of the recipient.
    pub recipient: [u8; 43],
    pub value: u64,
    pub rseed: [u8; 32],
    /// The full raw transaction.
    pub tx: Vec<u8>,
}

impl Receipt {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut b = Vec::with_capacity(90 + self.tx.len());
        b.push(FORMAT_VERSION);
        b.push(match self.network {
            NetworkType::Main => 0,
            NetworkType::Test => 1,
            NetworkType::Regtest => 2,
        });
        b.push(self.pool.to_byte());
        b.extend_from_slice(&self.height.to_le_bytes());
        b.extend_from_slice(&self.action_index.to_le_bytes());
        b.extend_from_slice(&self.recipient);
        b.extend_from_slice(&self.value.to_le_bytes());
        b.extend_from_slice(&self.rseed);
        b.extend_from_slice(&self.tx);
        b
    }

    pub fn from_bytes(b: &[u8]) -> Result<Self, Error> {
        const HEAD: usize = 1 + 1 + 1 + 4 + 2 + 43 + 8 + 32;
        if b.is_empty() {
            return Err(Error::Malformed);
        }
        if b[0] != FORMAT_VERSION {
            return Err(Error::UnknownVersion);
        }
        if b.len() <= HEAD {
            return Err(Error::Malformed);
        }
        let network = match b[1] {
            0 => NetworkType::Main,
            1 => NetworkType::Test,
            2 => NetworkType::Regtest,
            _ => return Err(Error::Malformed),
        };
        let pool = Pool::from_byte(b[2]).ok_or(Error::Malformed)?;
        let height = u32::from_le_bytes(b[3..7].try_into().unwrap());
        let action_index = u16::from_le_bytes(b[7..9].try_into().unwrap());
        let recipient = b[9..52].try_into().unwrap();
        let value = u64::from_le_bytes(b[52..60].try_into().unwrap());
        let rseed = b[60..92].try_into().unwrap();
        Ok(Receipt {
            network,
            pool,
            height,
            action_index,
            recipient,
            value,
            rseed,
            tx: b[HEAD..].to_vec(),
        })
    }

    /// Text form: `zr1` followed by URL-safe base64.
    pub fn encode(&self) -> String {
        format!("{PREFIX}{}", URL_SAFE_NO_PAD.encode(self.to_bytes()))
    }

    pub fn decode(s: &str) -> Result<Self, Error> {
        let s: String = s.trim().chars().filter(|c| !c.is_whitespace()).collect();
        // Accept a whole link as well as the bare receipt.
        let s = s.rsplit_once('#').map(|(_, f)| f).unwrap_or(&s);
        let body = s.strip_prefix(PREFIX).ok_or(Error::NotAReceipt)?;
        let bytes = URL_SAFE_NO_PAD.decode(body).map_err(|_| Error::Malformed)?;
        Self::from_bytes(&bytes)
    }
}

/// The memo of a payment, decoded as ZIP 302 describes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Memo {
    Empty,
    Text(String),
    /// Not text; shown as hex.
    Binary(String),
}

impl Memo {
    fn from_bytes(m: &[u8; 512]) -> Self {
        if m[0] == 0xF6 && m[1..].iter().all(|&b| b == 0) {
            return Memo::Empty;
        }
        if m[0] <= 0xF4 {
            let end = m.iter().rposition(|&b| b != 0).map_or(0, |i| i + 1);
            if let Ok(t) = std::str::from_utf8(&m[..end]) {
                return if t.is_empty() {
                    Memo::Empty
                } else {
                    Memo::Text(t.to_owned())
                };
            }
        }
        let end = m.iter().rposition(|&b| b != 0).map_or(0, |i| i + 1);
        Memo::Binary(m[..end].iter().map(|b| format!("{b:02x}")).collect())
    }
}

/// What a valid receipt proves.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Proven {
    /// Transaction ID, computed from the transaction itself.
    pub txid: String,
    pub height: u32,
    pub network: NetworkType,
    pub pool: Pool,
    pub action_index: usize,
    /// How many outputs the pool's bundle has; all but one stay private.
    pub action_count: usize,
    pub value: u64,
    /// The recipient as a unified address carrying only this receiver.
    pub recipient: String,
    pub memo: Memo,
}

fn bundle_for(
    tx: &Transaction,
    pool: Pool,
) -> Option<&orchard::Bundle<impl orchard::bundle::Authorization, zcash_protocol::value::ZatBalance>>
{
    match pool {
        Pool::Orchard => tx.orchard_bundle(),
        Pool::Ironwood => tx.ironwood_bundle(),
    }
}

fn parse_tx(raw: &[u8], network: NetworkType, height: u32) -> Result<Transaction, Error> {
    let branch = BranchId::for_height(&params(network), BlockHeight::from_u32(height));
    Transaction::read(raw, branch).map_err(|_| Error::BadTransaction)
}

/// Encodes a raw Orchard receiver as a unified address with just that receiver.
pub fn recipient_address(network: NetworkType, raw: &[u8; 43]) -> String {
    let ua = unified::Address::try_from_items(
        unified::Revision::R0,
        vec![unified::Uitem::Data(unified::Receiver::Orchard(*raw))],
    )
    .expect("one Orchard receiver is a valid unified address");
    ua.encode(&network)
}

/// Does this unified address contain the receipt's recipient?
/// Lets a merchant check "was this paid to me?" against the address they published.
pub fn address_contains(address: &str, network: NetworkType, raw: &[u8; 43]) -> bool {
    match unified::Address::decode(address.trim()) {
        Ok((net, _, ua)) => {
            net == network
                && ua
                    .items()
                    .iter()
                    .any(|r| matches!(r, unified::Receiver::Orchard(b) if b == raw))
        }
        Err(_) => false,
    }
}

fn open_with_rseed<V: DomainVersion, A>(
    action: &Action<A>,
    pool: Pool,
    recipient: &[u8; 43],
    value: u64,
    rseed: [u8; 32],
) -> Option<(Note, Address, [u8; 512])>
where
    NoteEncryptionDomain<V>: Domain<Note = Note, Recipient = Address, Memo = [u8; 512]>,
    Action<A>: zcash_note_encryption::ShieldedOutput<NoteEncryptionDomain<V>>,
{
    let rho: Rho = action.rho();
    let addr = Option::<Address>::from(Address::from_raw_address_bytes(recipient))?;
    let rseed = Option::<RandomSeed>::from(RandomSeed::from_bytes(rseed, &rho))?;
    let claimed = Option::<Note>::from(Note::from_parts(
        addr,
        NoteValue::from_raw(value),
        rho,
        rseed,
        pool.note_version(),
    ))?;
    let esk = NoteEncryptionDomain::<V>::derive_esk(&claimed)?;
    let pk_d = NoteEncryptionDomain::<V>::get_pk_d(&claimed);
    let domain = NoteEncryptionDomain::<V>::for_action(action);
    let (note, addr, memo) = try_output_recovery_with_pkd_esk(&domain, pk_d, esk, action)?;
    // The key that decrypts the output depends only on the recipient and the
    // seed, not the value, so the decrypted note must be compared in full
    // with the claimed one; otherwise a receipt could overstate the amount.
    (note == claimed && addr.to_raw_address_bytes() == *recipient).then_some((note, addr, memo))
}

/// The ID of the transaction inside a receipt, computed from its bytes.
pub fn transaction_id(r: &Receipt) -> Result<String, Error> {
    Ok(parse_tx(&r.tx, r.network, r.height)?.txid().to_string())
}

/// Checks a receipt against the transaction it carries.
///
/// This proves the payment is inside that transaction. The caller must still
/// confirm on chain that `Proven::txid` was mined at `Proven::height`.
pub fn verify(r: &Receipt) -> Result<Proven, Error> {
    let tx = parse_tx(&r.tx, r.network, r.height)?;
    let bundle = bundle_for(&tx, r.pool).ok_or(Error::NoBundle(r.pool.name()))?;
    let actions = bundle.actions();
    let i = r.action_index as usize;
    let action = actions.get(i).ok_or(Error::NoSuchOutput(i))?;
    let opened = match r.pool {
        Pool::Orchard => open_with_rseed::<orchard::note_encryption::OrchardVersion, _>(
            action,
            r.pool,
            &r.recipient,
            r.value,
            r.rseed,
        ),
        Pool::Ironwood => open_with_rseed::<orchard::note_encryption::IronwoodVersion, _>(
            action,
            r.pool,
            &r.recipient,
            r.value,
            r.rseed,
        ),
    };
    let (_, _, memo) = opened.ok_or(Error::Mismatch)?;
    Ok(Proven {
        txid: tx.txid().to_string(),
        height: r.height,
        network: r.network,
        pool: r.pool,
        action_index: i,
        action_count: actions.len(),
        value: r.value,
        recipient: recipient_address(r.network, &r.recipient),
        memo: Memo::from_bytes(&memo),
    })
}

/// Whether the viewing key's owner received or sent a payment.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Received,
    Sent,
}

/// A payment the viewing key can see, ready to be turned into a receipt.
#[derive(Clone, Debug)]
pub struct Found {
    pub direction: Direction,
    pub pool: Pool,
    pub action_index: usize,
    pub value: u64,
    pub recipient: String,
    pub memo: Memo,
    pub receipt: Receipt,
}

/// Reads the Orchard part of a unified full viewing key.
pub fn parse_viewing_key(ufvk: &str) -> Result<(NetworkType, FullViewingKey), Error> {
    let (net, _, ufvk) = unified::Ufvk::decode(ufvk.trim()).map_err(|_| Error::BadViewingKey)?;
    let bytes = ufvk
        .items()
        .into_iter()
        .find_map(|i| match i {
            unified::Fvk::Orchard(b) => Some(b),
            _ => None,
        })
        .ok_or(Error::NoOrchardKey)?;
    let fvk = FullViewingKey::from_bytes(&bytes).ok_or(Error::BadViewingKey)?;
    Ok((net, fvk))
}

fn scan<'a, V: DomainVersion, A: 'a>(
    actions: impl Iterator<Item = &'a Action<A>>,
    pool: Pool,
    fvk: &FullViewingKey,
    network: NetworkType,
    height: u32,
    raw_tx: &[u8],
    out: &mut Vec<Found>,
) where
    NoteEncryptionDomain<V>: Domain<
        Note = Note,
        Recipient = Address,
        Memo = [u8; 512],
        IncomingViewingKey = orchard::keys::PreparedIncomingViewingKey,
        OutgoingViewingKey = orchard::keys::OutgoingViewingKey,
        ValueCommitment = orchard::value::ValueCommitment,
    >,
    Action<A>: zcash_note_encryption::ShieldedOutput<NoteEncryptionDomain<V>>,
{
    // External scope only: internal-scope outputs are the wallet's own change.
    let ivk = fvk.to_ivk(Scope::External).prepare();
    let ovk = fvk.to_ovk(Scope::External);
    let internal = fvk.to_ivk(Scope::Internal).prepare();
    for (i, a) in actions.enumerate() {
        let domain = NoteEncryptionDomain::<V>::for_action(a);
        let (direction, hit) = if let Some(h) = try_note_decryption(&domain, &ivk, a) {
            (Direction::Received, h)
        } else if let Some(h) = try_output_recovery_with_ovk(
            &domain,
            &ovk,
            a,
            a.cv_net(),
            &a.encrypted_note().out_ciphertext,
        ) {
            // Skip sends the wallet made to its own change address.
            if try_note_decryption(&domain, &internal, a).is_some() {
                continue;
            }
            (Direction::Sent, h)
        } else {
            continue;
        };
        let (note, addr, memo) = hit;
        let recipient = addr.to_raw_address_bytes();
        out.push(Found {
            direction,
            pool,
            action_index: i,
            value: note.value().inner(),
            recipient: recipient_address(network, &recipient),
            memo: Memo::from_bytes(&memo),
            receipt: Receipt {
                network,
                pool,
                height,
                action_index: i as u16,
                recipient,
                value: note.value().inner(),
                rseed: *note.rseed().as_bytes(),
                tx: raw_tx.to_vec(),
            },
        });
    }
}

/// Finds every payment in a transaction that the viewing key received or sent,
/// each with a ready receipt. Runs entirely locally; the key is never sent anywhere.
pub fn find_payments(ufvk: &str, raw_tx: &[u8], height: u32) -> Result<Vec<Found>, Error> {
    let (network, fvk) = parse_viewing_key(ufvk)?;
    let tx = parse_tx(raw_tx, network, height)?;
    let mut out = Vec::new();
    if let Some(b) = tx.orchard_bundle() {
        scan::<orchard::note_encryption::OrchardVersion, _>(
            b.actions().iter(),
            Pool::Orchard,
            &fvk,
            network,
            height,
            raw_tx,
            &mut out,
        );
    }
    if let Some(b) = tx.ironwood_bundle() {
        scan::<orchard::note_encryption::IronwoodVersion, _>(
            b.actions().iter(),
            Pool::Ironwood,
            &fvk,
            network,
            height,
            raw_tx,
            &mut out,
        );
    }
    Ok(out)
}

/// Formats zatoshis as ZEC without trailing zeros, e.g. 250000000 -> "2.5".
pub fn format_zec(zat: u64) -> String {
    let whole = zat / 100_000_000;
    let frac = zat % 100_000_000;
    if frac == 0 {
        return whole.to_string();
    }
    let f = format!("{frac:08}");
    format!("{whole}.{}", f.trim_end_matches('0'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use orchard::{
        builder::{Builder, BundleType},
        bundle::BundleVersion,
        keys::SpendingKey,
        Anchor,
    };
    use rand::RngExt;

    fn key(rng: &mut impl rand::Rng) -> FullViewingKey {
        loop {
            if let Some(sk) = Option::<SpendingKey>::from(SpendingKey::from_bytes(rng.random())) {
                break FullViewingKey::from(&sk);
            }
        }
    }

    fn memo(text: &str) -> [u8; 512] {
        let mut m = [0u8; 512];
        m[..text.len()].copy_from_slice(text.as_bytes());
        m
    }

    struct Fixture {
        actions: Vec<Action<()>>,
        payer: FullViewingKey,
        shop: FullViewingKey,
        shop_addr: Address,
        other_addr: Address,
    }

    /// A bundle where `payer` pays a shop 2.5 ZEC and someone else 0.99 ZEC.
    fn fixture(version: BundleVersion) -> Fixture {
        let mut rng = rand::rng();
        let (payer, shop, other) = (key(&mut rng), key(&mut rng), key(&mut rng));
        let shop_addr = shop.address_at(0u32, Scope::External);
        let other_addr = other.address_at(0u32, Scope::External);
        let mut b = Builder::new(
            BundleType::DEFAULT,
            version,
            version.default_flags(),
            Anchor::empty_tree(),
        )
        .unwrap();
        let ovk = Some(payer.to_ovk(Scope::External));
        b.add_output(
            ovk.clone(),
            shop_addr,
            NoteValue::from_raw(250_000_000),
            memo("Invoice #1042"),
        )
        .unwrap();
        b.add_output(
            ovk,
            other_addr,
            NoteValue::from_raw(99_000_000),
            memo("private"),
        )
        .unwrap();
        let (bundle, _) = b.build::<i64>(&mut rng).unwrap().unwrap();
        let actions = bundle
            .actions()
            .iter()
            .cloned()
            .map(|a| a.map(|_| ()))
            .collect();
        Fixture {
            actions,
            payer,
            shop,
            shop_addr,
            other_addr,
        }
    }

    fn found(f: &Fixture, fvk: &FullViewingKey, pool: Pool) -> Vec<Found> {
        let mut out = Vec::new();
        match pool {
            Pool::Orchard => scan::<orchard::note_encryption::OrchardVersion, _>(
                f.actions.iter(),
                pool,
                fvk,
                NetworkType::Main,
                1,
                &[],
                &mut out,
            ),
            Pool::Ironwood => scan::<orchard::note_encryption::IronwoodVersion, _>(
                f.actions.iter(),
                pool,
                fvk,
                NetworkType::Main,
                1,
                &[],
                &mut out,
            ),
        }
        out
    }

    fn open(f: &Fixture, r: &Receipt) -> Option<(Note, Address, [u8; 512])> {
        let a = f.actions.get(r.action_index as usize)?;
        match r.pool {
            Pool::Orchard => open_with_rseed::<orchard::note_encryption::OrchardVersion, _>(
                a,
                r.pool,
                &r.recipient,
                r.value,
                r.rseed,
            ),
            Pool::Ironwood => open_with_rseed::<orchard::note_encryption::IronwoodVersion, _>(
                a,
                r.pool,
                &r.recipient,
                r.value,
                r.rseed,
            ),
        }
    }

    fn roundtrip(version: BundleVersion, pool: Pool) {
        let f = fixture(version);
        // The shop sees what it received; the payer sees both payments it sent.
        let shop = found(&f, &f.shop, pool);
        assert_eq!(shop.len(), 1);
        assert_eq!(shop[0].direction, Direction::Received);
        assert_eq!(shop[0].memo, Memo::Text("Invoice #1042".into()));
        let paid = found(&f, &f.payer, pool);
        assert_eq!(paid.len(), 2);
        assert!(paid.iter().all(|p| p.direction == Direction::Sent));

        // Receipts made by either side open exactly their own output.
        let by_payer = paid
            .iter()
            .find(|p| p.value == 250_000_000)
            .unwrap()
            .receipt
            .clone();
        let by_shop = shop[0].receipt.clone();
        assert_eq!(by_payer.rseed, by_shop.rseed);
        let (note, addr, m) = open(&f, &by_payer).expect("honest receipt opens");
        assert_eq!(addr, f.shop_addr);
        assert_eq!(note.value().inner(), 250_000_000);
        assert_eq!(Memo::from_bytes(&m), Memo::Text("Invoice #1042".into()));

        // Lies fail: amount, recipient, seed, and pointing at another output.
        assert!(open(
            &f,
            &Receipt {
                value: 900_000_000,
                ..by_payer.clone()
            }
        )
        .is_none());
        assert!(open(
            &f,
            &Receipt {
                recipient: f.other_addr.to_raw_address_bytes(),
                ..by_payer.clone()
            }
        )
        .is_none());
        let mut seed = by_payer.rseed;
        seed[0] ^= 1;
        assert!(open(
            &f,
            &Receipt {
                rseed: seed,
                ..by_payer.clone()
            }
        )
        .is_none());
        for i in 0..f.actions.len() {
            if i != by_payer.action_index as usize {
                assert!(open(
                    &f,
                    &Receipt {
                        action_index: i as u16,
                        ..by_payer.clone()
                    }
                )
                .is_none());
            }
        }
        // A stranger's viewing key finds nothing.
        let stranger = key(&mut rand::rng());
        assert!(found(&f, &stranger, pool).is_empty());
    }

    #[test]
    fn orchard_receipts() {
        roundtrip(BundleVersion::orchard_v2(), Pool::Orchard);
    }

    #[test]
    fn ironwood_receipts() {
        roundtrip(BundleVersion::ironwood_v3(), Pool::Ironwood);
    }

    #[test]
    fn wrong_pool_does_not_open() {
        let f = fixture(BundleVersion::orchard_v2());
        let r = found(&f, &f.shop, Pool::Orchard)[0].receipt.clone();
        assert!(open(
            &f,
            &Receipt {
                pool: Pool::Ironwood,
                ..r
            }
        )
        .is_none());
    }

    #[test]
    fn encoding_roundtrip_and_links() {
        let r = Receipt {
            network: NetworkType::Test,
            pool: Pool::Ironwood,
            height: 4_544_259,
            action_index: 1,
            recipient: [7; 43],
            value: 123,
            rseed: [9; 32],
            tx: vec![1, 2, 3],
        };
        let s = r.encode();
        assert!(s.starts_with("zr1"));
        assert_eq!(Receipt::decode(&s).unwrap(), r);
        assert_eq!(
            Receipt::decode(&format!("https://example.com/check#{s}")).unwrap(),
            r
        );
        assert_eq!(
            Receipt::decode(&format!("  {}\n{}  ", &s[..20], &s[20..])).unwrap(),
            r
        );
        assert_eq!(Receipt::decode("hello"), Err(Error::NotAReceipt));
        assert_eq!(Receipt::decode("zr1!!!"), Err(Error::Malformed));
        assert_eq!(Receipt::decode("zr1AQ"), Err(Error::Malformed));
        assert_eq!(Receipt::decode("zr1Ag"), Err(Error::UnknownVersion));
    }

    #[test]
    fn real_testnet_transaction() {
        let raw = include_bytes!("../tests/data/testnet-4544259.tx");
        let tx = parse_tx(raw, NetworkType::Test, 4_544_259).unwrap();
        assert_eq!(
            tx.txid().to_string(),
            "7646b10c3ccfc926be465c80d82afe2d24b7381837e3805675924a29379c44e8"
        );
        // A made-up receipt against a real transaction is rejected, not accepted.
        let fake = Receipt {
            network: NetworkType::Test,
            pool: Pool::Orchard,
            height: 4_544_259,
            action_index: 0,
            recipient: f_addr(),
            value: 100_000_000,
            rseed: [3; 32],
            tx: raw.to_vec(),
        };
        assert_eq!(verify(&fake), Err(Error::Mismatch));
        assert_eq!(
            verify(&Receipt {
                action_index: 9,
                ..fake.clone()
            }),
            Err(Error::NoSuchOutput(9))
        );
        // This transaction moves funds from Orchard to Ironwood, so it has both.
        assert_eq!(
            verify(&Receipt {
                pool: Pool::Ironwood,
                ..fake.clone()
            }),
            Err(Error::Mismatch)
        );
        assert_eq!(
            verify(&Receipt {
                tx: raw[..100].to_vec(),
                ..fake
            }),
            Err(Error::BadTransaction)
        );
    }

    fn f_addr() -> [u8; 43] {
        key(&mut rand::rng())
            .address_at(0u32, Scope::External)
            .to_raw_address_bytes()
    }

    #[test]
    fn addresses_and_memos() {
        let raw = f_addr();
        let ua = recipient_address(NetworkType::Main, &raw);
        assert!(ua.starts_with("u1"));
        assert!(address_contains(&ua, NetworkType::Main, &raw));
        assert!(!address_contains(&ua, NetworkType::Test, &raw));
        assert!(!address_contains(&ua, NetworkType::Main, &f_addr()));
        assert!(!address_contains("not an address", NetworkType::Main, &raw));
        let mut empty = [0u8; 512];
        empty[0] = 0xF6;
        assert_eq!(Memo::from_bytes(&empty), Memo::Empty);
        assert_eq!(Memo::from_bytes(&memo("hi")), Memo::Text("hi".into()));
        let mut bin = [0u8; 512];
        bin[0] = 0xFF;
        bin[1] = 0xAB;
        assert_eq!(Memo::from_bytes(&bin), Memo::Binary("ffab".into()));
        assert_eq!(format_zec(250_000_000), "2.5");
        assert_eq!(format_zec(100_000_000), "1");
        assert_eq!(format_zec(15_000), "0.00015");
    }
}

//! Blockchain Service - Smart contract interactions
//!
//! Handles all interactions with the EconomicStrategyRouter
//! and payment processing on Gnosis Chain.

use anyhow::Result;
use ethers::prelude::*;
use std::sync::Arc;

/// Blockchain service for contract interactions
pub struct BlockchainService {
    provider: Arc<Provider<Http>>,
    router_address: Address,
}

impl BlockchainService {
    pub fn new(rpc_url: &str, router_address: &str) -> Result<Self> {
        let provider = Provider::<Http>::try_from(rpc_url)?;
        let router_address = router_address.parse()?;

        Ok(Self {
            provider: Arc::new(provider),
            router_address,
        })
    }

    /// Get current block number
    pub async fn get_block_number(&self) -> Result<u64> {
        Ok(self.provider.get_block_number().await?.as_u64())
    }

    /// Verify a signature
    pub fn verify_signature(
        &self,
        message: &[u8],
        signature: &[u8],
        expected_signer: Address,
    ) -> Result<bool> {
        let signature = Signature::try_from(signature)?;
        let recovered = signature.recover(message)?;
        Ok(recovered == expected_signer)
    }

    /// Get strategy address for a song
    pub async fn get_song_strategy(&self, _song_id: [u8; 32]) -> Result<Option<Address>> {
        // TODO: Call router.songStrategy(songId)
        Ok(None)
    }

    /// Process a payment through the router
    pub async fn process_payment(
        &self,
        _song_id: [u8; 32],
        _amount: U256,
        _payment_type: u8,
    ) -> Result<H256> {
        // TODO: Call router.processPayment(songId, amount, paymentType)
        // This requires a signer wallet
        Err(anyhow::anyhow!("Payment processing not yet implemented"))
    }
}

/// Payment types matching the contract enum
#[derive(Debug, Clone, Copy)]
pub enum PaymentType {
    Stream = 0,
    Download = 1,
    Tip = 2,
    Patronage = 3,
    NftAccess = 4,
}

impl From<PaymentType> for u8 {
    fn from(pt: PaymentType) -> u8 {
        pt as u8
    }
}

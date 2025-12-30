# Security Policy

Mycelix Music takes security seriously. Before any mainnet deployment we intend to:

- Commission an external smart contract audit (target budget $15–25K).
- Run internal reviews for reentrancy, authorization, and token-transfer safety.
- Add comprehensive tests and fuzzing for edge cases (fee math, split sums, min payments).
- Prefer SafeERC20 for token operations and follow OpenZeppelin best practices.

Reporting a Vulnerability
- Please open a private security report by emailing security@mycelix.music with details and reproduction steps.
- We will acknowledge within 72 hours and coordinate a remediation timeline.

Scope
- Solidity contracts under `contracts/src/`.
- Any off-chain components that affect on-chain state or funds.

Out of Scope
- Demo/mock endpoints and placeholder integrations in the API and frontend.

Thank you for helping keep Mycelix Music safe.


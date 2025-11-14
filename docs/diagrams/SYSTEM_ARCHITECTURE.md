# System Architecture Diagrams

Visual representations of the Mycelix Music platform architecture.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Smart Contract Architecture](#smart-contract-architecture)
- [Data Flow](#data-flow)
- [Payment Flow](#payment-flow)
- [Deployment Architecture](#deployment-architecture)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        Web[Next.js Web App]
        Mobile[Mobile App - Future]
    end

    subgraph "Backend Layer"
        API[Express REST API]
        Cache[Redis Cache]
        DB[(PostgreSQL DB)]
    end

    subgraph "Blockchain Layer"
        Router[Economic Strategy Router]
        PPS[Pay-Per-Stream Strategy]
        GE[Gift Economy Strategy]
        Custom[Custom Strategies]
        Token[Flow Token - ERC20]
    end

    subgraph "Storage Layer"
        IPFS[IPFS - Audio & Metadata]
        Ceramic[Ceramic - Epistemic Claims]
    end

    subgraph "External Services"
        Privy[Privy - Auth]
        Analytics[Analytics Service]
    end

    %% Frontend connections
    Web -->|API Calls| API
    Web -->|Wallet Auth| Privy
    Web -->|Contract Calls| Router

    %% Backend connections
    API -->|Cache Check| Cache
    API -->|Read/Write| DB
    API -->|Upload| IPFS
    API -->|DKG Claims| Ceramic
    API -->|Track Events| Analytics

    %% Smart contract connections
    Router -->|Route Payments| PPS
    Router -->|Route Payments| GE
    Router -->|Route Payments| Custom
    Router -->|Transfer| Token
    PPS -->|Use| Token
    GE -->|Use| Token

    %% Storage connections
    Web -->|Fetch Files| IPFS
    Web -->|Verify Claims| Ceramic

    style Web fill:#3b82f6
    style API fill:#10b981
    style Router fill:#f59e0b
    style IPFS fill:#8b5cf6
```

---

## Smart Contract Architecture

```mermaid
classDiagram
    class IEconomicStrategy {
        <<interface>>
        +processPlay(songId, listener, amount)
        +calculateSplits(songId, amount)
    }

    class EconomicStrategyRouter {
        -mapping songStrategy
        -mapping songArtist
        -FlowToken flowToken
        +registerSong(songId, artist, strategy)
        +processPlay(songId, listener, amount)
        +previewSplits(songId, amount)
        +getSongArtist(songId)
    }

    class PayPerStreamStrategy {
        -mapping royaltySplits
        -address router
        +configureRoyaltySplit(songId, recipients, basisPoints, roles)
        +processPlay(songId, listener, amount)
        +calculateSplits(songId, amount)
    }

    class GiftEconomyStrategy {
        -mapping giftConfigs
        -mapping listenerProfiles
        -address router
        +configureGiftEconomy(songId, artist, cgcPerListen, bonus, threshold, multiplier)
        +processPlay(songId, listener, amount)
        +calculateSplits(songId, amount)
        +getListenerProfile(songId, listener)
    }

    class FlowToken {
        <<ERC20>>
        +mint(to, amount)
        +burn(from, amount)
        +transfer(to, amount)
        +approve(spender, amount)
    }

    IEconomicStrategy <|.. PayPerStreamStrategy
    IEconomicStrategy <|.. GiftEconomyStrategy
    EconomicStrategyRouter --> IEconomicStrategy
    EconomicStrategyRouter --> FlowToken
    PayPerStreamStrategy --> FlowToken
    GiftEconomyStrategy --> FlowToken
```

---

## Data Flow

### Song Upload Flow

```mermaid
sequenceDiagram
    actor Artist
    participant Frontend
    participant API
    participant IPFS
    participant Router
    participant Strategy

    Artist->>Frontend: Upload song file & metadata
    Frontend->>IPFS: Upload audio file
    IPFS-->>Frontend: Return IPFS hash
    Frontend->>IPFS: Upload cover art
    IPFS-->>Frontend: Return cover hash
    Frontend->>API: Store song metadata
    API-->>Frontend: Confirm storage
    Frontend->>Router: Register song
    Router-->>Frontend: Return songId
    Frontend->>Strategy: Configure economic params
    Strategy-->>Frontend: Confirm configuration
    Frontend->>Artist: Show success + songId
```

### Song Playback Flow

```mermaid
sequenceDiagram
    actor Listener
    participant Frontend
    participant API
    participant Cache
    participant Router
    participant Strategy
    participant Token

    Listener->>Frontend: Click play on song
    Frontend->>API: GET /api/songs/:id
    API->>Cache: Check cache
    alt Cache hit
        Cache-->>API: Return cached data
    else Cache miss
        API->>Database: Query song
        Database-->>API: Return song data
        API->>Cache: Store in cache
    end
    API-->>Frontend: Song metadata

    Frontend->>IPFS: Fetch audio file
    IPFS-->>Frontend: Stream audio

    Frontend->>Token: Approve router
    Token-->>Frontend: Approval confirmed

    Frontend->>Router: processPlay(songId, listener, amount)
    Router->>Strategy: processPlay()
    Strategy->>Token: transferFrom(listener, strategy)
    Strategy->>Strategy: Calculate splits
    Strategy->>Token: transfer(artist, artistShare)
    Strategy->>Token: transfer(producer, producerShare)
    Strategy-->>Router: Return netAmount
    Router-->>Frontend: Transaction receipt

    Frontend->>API: POST /api/plays (track event)
    API-->>Frontend: Confirmation

    Frontend->>Listener: Play audio
```

---

## Payment Flow

### Pay-Per-Stream Payment Distribution

```mermaid
graph LR
    Listener[Listener Pays 0.01 FLOW]

    Listener -->|0.01 FLOW| Router[Router]

    Router -->|Routes to| Strategy[PayPerStreamStrategy]

    Strategy -->|Split| Artist[Artist: 60%]
    Strategy -->|Split| Producer[Producer: 30%]
    Strategy -->|Split| Platform[Platform: 10%]

    Artist -->|0.006 FLOW| ArtistWallet[Artist Wallet]
    Producer -->|0.003 FLOW| ProducerWallet[Producer Wallet]
    Platform -->|0.001 FLOW| PlatformWallet[Platform Wallet]

    style Listener fill:#3b82f6
    style Strategy fill:#f59e0b
    style Artist fill:#10b981
    style Producer fill:#10b981
    style Platform fill:#10b981
```

### Gift Economy Reward Flow

```mermaid
graph TB
    Listener[Listener]

    Listener -->|Plays Song| GE[Gift Economy Strategy]

    GE -->|Check| Profile{Listener Profile}

    Profile -->|New Listener| EarlyBonus[Early Supporter Bonus]
    Profile -->|< 100 plays| Normal[Base CGC Reward]
    Profile -->|> 100 plays| Loyalty[Loyalty Multiplier]

    EarlyBonus -->|5 CGC + 1 CGC| Reward1[Total: 6 CGC]
    Normal -->|1 CGC| Reward2[Total: 1 CGC]
    Loyalty -->|1 CGC × 1.5x| Reward3[Total: 1.5 CGC]

    Reward1 -->|Mint CGC| ListenerWallet[Listener Wallet]
    Reward2 -->|Mint CGC| ListenerWallet
    Reward3 -->|Mint CGC| ListenerWallet

    style Listener fill:#3b82f6
    style GE fill:#8b5cf6
    style ListenerWallet fill:#10b981
```

---

## Deployment Architecture

### Production Deployment

```mermaid
graph TB
    subgraph "DNS & CDN"
        DNS[Domain: mycelix.com]
        CDN[Cloudflare CDN]
    end

    subgraph "Frontend - Vercel"
        NextJS[Next.js Application]
        Static[Static Assets]
    end

    subgraph "Backend - AWS/DigitalOcean"
        LB[Load Balancer]
        API1[API Instance 1]
        API2[API Instance 2]
        API3[API Instance 3]
    end

    subgraph "Database Layer"
        PG_Primary[(PostgreSQL Primary)]
        PG_Replica[(PostgreSQL Replica)]
        Redis_Cluster[Redis Cluster]
    end

    subgraph "Blockchain"
        Gnosis[Gnosis Chain RPC]
        Contracts[Deployed Contracts]
    end

    subgraph "Storage"
        IPFS_Cluster[IPFS Cluster]
        S3[S3 Backup]
    end

    subgraph "Monitoring"
        Datadog[Datadog APM]
        Sentry[Sentry Errors]
        Logs[Log Aggregation]
    end

    DNS --> CDN
    CDN --> NextJS
    CDN --> Static

    NextJS --> LB
    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> PG_Primary
    API2 --> PG_Primary
    API3 --> PG_Primary

    PG_Primary --> PG_Replica

    API1 --> Redis_Cluster
    API2 --> Redis_Cluster
    API3 --> Redis_Cluster

    NextJS --> Gnosis
    API1 --> Gnosis
    Gnosis --> Contracts

    API1 --> IPFS_Cluster
    IPFS_Cluster --> S3

    API1 --> Datadog
    API1 --> Sentry
    API1 --> Logs

    style NextJS fill:#3b82f6
    style LB fill:#10b981
    style PG_Primary fill:#f59e0b
    style Gnosis fill:#8b5cf6
```

### Development Environment

```mermaid
graph TB
    subgraph "Local Machine"
        Dev[Developer]
        Browser[Browser: localhost:3000]
        VSCode[VS Code]
    end

    subgraph "Docker Compose Services"
        Anvil[Anvil - Local Blockchain]
        PostgreSQL[(PostgreSQL)]
        Redis_Local[Redis]
        IPFS_Local[IPFS Node]
        Ceramic_Local[Ceramic Node]
    end

    subgraph "Development Servers"
        NextDev[Next.js Dev Server]
        APIDev[API Dev Server]
    end

    Dev --> VSCode
    VSCode --> NextDev
    VSCode --> APIDev

    Browser --> NextDev
    Browser --> APIDev
    Browser --> Anvil

    NextDev --> APIDev
    APIDev --> PostgreSQL
    APIDev --> Redis_Local
    APIDev --> IPFS_Local
    APIDev --> Ceramic_Local

    NextDev --> Anvil

    style Dev fill:#3b82f6
    style NextDev fill:#10b981
    style APIDev fill:#10b981
    style Anvil fill:#f59e0b
```

---

## Component Interaction Diagram

```mermaid
graph TB
    subgraph "User Interfaces"
        Artist[Artist Interface]
        Listener[Listener Interface]
    end

    subgraph "Application Layer"
        Upload[Upload Wizard]
        Player[Music Player]
        Dashboard[Analytics Dashboard]
    end

    subgraph "SDK Layer"
        SDK[Mycelix SDK]
    end

    subgraph "Smart Contracts"
        Router[Router Contract]
        Strategies[Strategy Contracts]
    end

    subgraph "APIs & Services"
        REST[REST API]
        Storage[Storage Services]
    end

    Artist --> Upload
    Listener --> Player
    Artist --> Dashboard

    Upload --> SDK
    Player --> SDK
    Dashboard --> REST

    SDK --> Router
    SDK --> REST
    Router --> Strategies

    REST --> Storage
    SDK --> Storage

    style Artist fill:#3b82f6
    style Listener fill:#3b82f6
    style SDK fill:#10b981
    style Router fill:#f59e0b
```

---

## Notes

- All diagrams are rendered using Mermaid syntax
- View on GitHub or use a Mermaid-compatible viewer
- Diagrams are automatically rendered in most modern documentation platforms
- For high-resolution exports, use tools like [Mermaid Live Editor](https://mermaid.live/)

---

**Last Updated:** 2025-01-15

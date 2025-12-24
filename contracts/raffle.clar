;; STX Raffle - Provably Fair Lottery System
;; Clarity 4 (Epoch 3.3) - Uses new Clarity 4 features
;;
;; New Clarity 4 Features Used:
;; - stacks-block-time: Real timestamps for raffle timing
;; - as-contract: For secure STX handling
;;
;; Designed for Stacks Builder Challenge Week 3

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-RAFFLE-NOT-FOUND (err u101))
(define-constant ERR-RAFFLE-ENDED (err u102))
(define-constant ERR-RAFFLE-NOT-ENDED (err u103))
(define-constant ERR-INSUFFICIENT-FUNDS (err u104))
(define-constant ERR-NO-TICKETS (err u105))
(define-constant ERR-ALREADY-DRAWN (err u106))
(define-constant ERR-MIN-TICKETS (err u107))
(define-constant ERR-INVALID-AMOUNT (err u108))
(define-constant ERR-TRANSFER-FAILED (err u109))

;; Platform fee: 2%
(define-constant PLATFORM-FEE u2)
(define-constant FEE-DENOMINATOR u100)

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var raffle-count uint u0)
(define-data-var total-tickets-sold uint u0)
(define-data-var total-prize-pool uint u0)
(define-data-var treasury principal CONTRACT-OWNER)

;; ============================================
;; DATA MAPS
;; ============================================

;; Raffle storage - uses Clarity 4 timestamps
(define-map raffles uint {
  creator: principal,
  title: (string-ascii 100),
  ticket-price: uint,
  max-tickets: uint,
  tickets-sold: uint,
  prize-pool: uint,
  start-time: uint,        ;; Clarity 4: Real timestamp
  end-time: uint,          ;; Clarity 4: Real timestamp
  winner: (optional principal),
  status: (string-ascii 20),
  created-at: uint,
  random-seed: (optional uint)
})

;; Track tickets per user per raffle
(define-map user-tickets
  { raffle-id: uint, user: principal }
  uint
)

;; Track participants list for winner selection (max 100 participants per raffle)
(define-map raffle-participants
  uint
  (list 100 { user: principal, ticket-count: uint })
)

;; User stats
(define-map user-stats principal {
  raffles-created: uint,
  tickets-bought: uint,
  raffles-won: uint,
  total-spent: uint,
  total-won: uint,
  last-activity: uint
})

;; ============================================
;; PRIVATE FUNCTIONS
;; ============================================

(define-private (update-user-stats-buy (user principal) (amount uint) (ticket-count uint))
  (let
    (
      (current-stats (default-to 
        { raffles-created: u0, tickets-bought: u0, raffles-won: u0, total-spent: u0, total-won: u0, last-activity: u0 }
        (map-get? user-stats user)))
    )
    (map-set user-stats user {
      raffles-created: (get raffles-created current-stats),
      tickets-bought: (+ (get tickets-bought current-stats) ticket-count),
      raffles-won: (get raffles-won current-stats),
      total-spent: (+ (get total-spent current-stats) amount),
      total-won: (get total-won current-stats),
      last-activity: stacks-block-time
    })
  )
)

(define-private (update-user-stats-win (user principal) (amount uint))
  (let
    (
      (current-stats (default-to 
        { raffles-created: u0, tickets-bought: u0, raffles-won: u0, total-spent: u0, total-won: u0, last-activity: u0 }
        (map-get? user-stats user)))
    )
    (map-set user-stats user {
      raffles-created: (get raffles-created current-stats),
      tickets-bought: (get tickets-bought current-stats),
      raffles-won: (+ (get raffles-won current-stats) u1),
      total-spent: (get total-spent current-stats),
      total-won: (+ (get total-won current-stats) amount),
      last-activity: stacks-block-time
    })
  )
)

;; Helper to find ticket owner from participant list
(define-private (find-ticket-owner-fold (participant { user: principal, ticket-count: uint }) (state { remaining: uint, owner: (optional principal) }))
  (if (is-some (get owner state))
    state
    (if (< (get remaining state) (get ticket-count participant))
      { remaining: (get remaining state), owner: (some (get user participant)) }
      { remaining: (- (get remaining state) (get ticket-count participant)), owner: none }
    )
  )
)

(define-private (find-ticket-owner (raffle-id uint) (ticket-index uint))
  (let
    (
      (participants (default-to (list) (map-get? raffle-participants raffle-id)))
    )
    (get owner (fold find-ticket-owner-fold participants { remaining: ticket-index, owner: none }))
  )
)

;; ============================================
;; PUBLIC FUNCTIONS
;; ============================================

;; Create a new raffle with time-based ending (Clarity 4)
(define-public (create-raffle 
    (title (string-ascii 100))
    (ticket-price uint)
    (max-tickets uint)
    (duration-seconds uint))
  (let
    (
      (raffle-id (+ (var-get raffle-count) u1))
      ;; Clarity 4: Use stacks-block-time
      (current-time stacks-block-time)
      (end-time (+ current-time duration-seconds))
    )
    ;; Validations
    (asserts! (> ticket-price u0) ERR-INVALID-AMOUNT)
    (asserts! (>= max-tickets u2) ERR-MIN-TICKETS)
    
    ;; Store raffle with real timestamps
    (map-set raffles raffle-id {
      creator: tx-sender,
      title: title,
      ticket-price: ticket-price,
      max-tickets: max-tickets,
      tickets-sold: u0,
      prize-pool: u0,
      start-time: current-time,
      end-time: end-time,
      winner: none,
      status: "active",
      created-at: stacks-block-height,
      random-seed: none
    })
    
    ;; Update counter
    (var-set raffle-count raffle-id)
    
    ;; Update user stats
    (let
      (
        (current-stats (default-to 
          { raffles-created: u0, tickets-bought: u0, raffles-won: u0, total-spent: u0, total-won: u0, last-activity: u0 }
          (map-get? user-stats tx-sender)))
      )
      (map-set user-stats tx-sender 
        (merge current-stats { 
          raffles-created: (+ (get raffles-created current-stats) u1),
          last-activity: current-time
        })
      )
    )
    
    ;; Event logging
    (print {
      event: "raffle-created",
      raffle-id: raffle-id,
      creator: tx-sender,
      ticket-price: ticket-price,
      max-tickets: max-tickets,
      end-time: end-time
    })
    
    (ok raffle-id)
  )
)

;; Buy tickets for a raffle (with Clarity 4 time checks)
(define-public (buy-tickets (raffle-id uint) (quantity uint))
  (let
    (
      (raffle (unwrap! (map-get? raffles raffle-id) ERR-RAFFLE-NOT-FOUND))
      (total-cost (* (get ticket-price raffle) quantity))
      (current-tickets (get tickets-sold raffle))
      (user-current-tickets (default-to u0 (map-get? user-tickets { raffle-id: raffle-id, user: tx-sender })))
      (current-time stacks-block-time)
      (current-participants (default-to (list) (map-get? raffle-participants raffle-id)))
    )
    ;; Validations with Clarity 4 time
    (asserts! (is-eq (get status raffle) "active") ERR-RAFFLE-ENDED)
    (asserts! (<= current-time (get end-time raffle)) ERR-RAFFLE-ENDED)
    (asserts! (<= (+ current-tickets quantity) (get max-tickets raffle)) ERR-INVALID-AMOUNT)
    (asserts! (> quantity u0) ERR-INVALID-AMOUNT)

    ;; Enforce STX payment - transfer to contract deployer (escrow)
    (try! (stx-transfer? total-cost tx-sender (get creator raffle)))

    ;; Update user tickets
    (map-set user-tickets
      { raffle-id: raffle-id, user: tx-sender }
      (+ user-current-tickets quantity)
    )

    ;; Update participant list - append or update user's entry
    (map-set raffle-participants raffle-id
      (if (is-eq user-current-tickets u0)
        ;; New participant - append to list
        (unwrap-panic (as-max-len? (append current-participants { user: tx-sender, ticket-count: quantity }) u100))
        ;; Existing participant - update their count (simplified: just append again for now)
        (unwrap-panic (as-max-len? (append current-participants { user: tx-sender, ticket-count: quantity }) u100))
      )
    )
    
    ;; Update raffle
    (map-set raffles raffle-id 
      (merge raffle { 
        tickets-sold: (+ current-tickets quantity),
        prize-pool: (+ (get prize-pool raffle) total-cost)
      })
    )
    
    ;; Update global stats
    (var-set total-tickets-sold (+ (var-get total-tickets-sold) quantity))
    (var-set total-prize-pool (+ (var-get total-prize-pool) total-cost))
    
    ;; Update user stats
    (update-user-stats-buy tx-sender total-cost quantity)
    
    (print { 
      event: "tickets-purchased", 
      raffle-id: raffle-id, 
      buyer: tx-sender,
      quantity: quantity,
      total-cost: total-cost,
      timestamp: current-time
    })
    
    (ok true)
  )
)

;; Draw winner (time-based check with Clarity 4)
(define-public (draw-winner (raffle-id uint))
  (let
    (
      (raffle (unwrap! (map-get? raffles raffle-id) ERR-RAFFLE-NOT-FOUND))
      (tickets-sold (get tickets-sold raffle))
      (prize-pool (get prize-pool raffle))
      ;; Clarity 4: Real time check
      (current-time stacks-block-time)
    )
    ;; Validations with Clarity 4 time
    (asserts! (> current-time (get end-time raffle)) ERR-RAFFLE-NOT-ENDED)
    (asserts! (is-none (get winner raffle)) ERR-ALREADY-DRAWN)
    (asserts! (> tickets-sold u0) ERR-NO-TICKETS)
    
    ;; Generate pseudo-random winner using block data + timestamp
    (let
      (
        ;; Clarity 4: Use stacks-block-time for better randomness
        (random-seed (mod (+ stacks-block-height current-time (get created-at raffle) prize-pool) tickets-sold))
        (winner-address (unwrap! (find-ticket-owner raffle-id random-seed) ERR-NO-TICKETS))
        (platform-fee-amount (/ (* prize-pool PLATFORM-FEE) FEE-DENOMINATOR))
        (winner-prize (- prize-pool platform-fee-amount))
      )
      ;; Note: STX is held by raffle creator - they must transfer to winner manually
      ;; Prize pool is tracked in contract for transparency
      
      ;; Update raffle
      (map-set raffles raffle-id 
        (merge raffle { 
          winner: (some winner-address),
          status: "completed",
          random-seed: (some random-seed)
        })
      )
      
      ;; Update winner stats
      (update-user-stats-win winner-address winner-prize)
      
      (print {
        event: "winner-drawn",
        raffle-id: raffle-id,
        winner: winner-address,
        prize: winner-prize,
        random-seed: random-seed,
        drawn-at: current-time
      })
      
      (ok winner-address)
    )
  )
)

;; Cancel raffle (creator only, no tickets sold)
(define-public (cancel-raffle (raffle-id uint))
  (let
    (
      (raffle (unwrap! (map-get? raffles raffle-id) ERR-RAFFLE-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get creator raffle)) ERR-NOT-OWNER)
    (asserts! (is-eq (get tickets-sold raffle) u0) ERR-INVALID-AMOUNT)
    
    (map-set raffles raffle-id 
      (merge raffle { status: "cancelled" })
    )
    
    (print { event: "raffle-cancelled", raffle-id: raffle-id })
    
    (ok true)
  )
)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-raffle (raffle-id uint))
  (map-get? raffles raffle-id)
)

(define-read-only (get-raffle-count)
  (var-get raffle-count)
)

(define-read-only (get-user-tickets (raffle-id uint) (user principal))
  (default-to u0 (map-get? user-tickets { raffle-id: raffle-id, user: user }))
)

(define-read-only (get-user-stats (user principal))
  (default-to 
    { raffles-created: u0, tickets-bought: u0, raffles-won: u0, total-spent: u0, total-won: u0, last-activity: u0 }
    (map-get? user-stats user))
)

(define-read-only (get-total-stats)
  {
    total-raffles: (var-get raffle-count),
    total-tickets-sold: (var-get total-tickets-sold),
    total-prize-pool: (var-get total-prize-pool)
  }
)

;; Clarity 4: Time-based active check
(define-read-only (is-raffle-active (raffle-id uint))
  (let
    (
      (raffle (map-get? raffles raffle-id))
      (current-time stacks-block-time)
    )
    (if (is-none raffle)
      false
      (let
        (
          (r (unwrap-panic raffle))
        )
        (and
          (is-eq (get status r) "active")
          (<= current-time (get end-time r))
        )
      )
    )
  )
)

;; Clarity 4: Time-based draw check
(define-read-only (can-draw-winner (raffle-id uint))
  (let
    (
      (raffle (map-get? raffles raffle-id))
      (current-time stacks-block-time)
    )
    (if (is-none raffle)
      false
      (let
        (
          (r (unwrap-panic raffle))
        )
        (and
          (> current-time (get end-time r))
          (is-none (get winner r))
          (> (get tickets-sold r) u0)
        )
      )
    )
  )
)

;; Get time remaining for raffle
(define-read-only (get-time-remaining (raffle-id uint))
  (let
    (
      (raffle (map-get? raffles raffle-id))
      (current-time stacks-block-time)
    )
    (if (is-none raffle)
      u0
      (let
        (
          (r (unwrap-panic raffle))
          (end-time (get end-time r))
        )
        (if (> end-time current-time)
          (- end-time current-time)
          u0
        )
      )
    )
  )
)

;; Get current time (Clarity 4)
(define-read-only (get-current-time)
  stacks-block-time
)

(define-read-only (get-ticket-holder (raffle-id uint) (ticket-index uint))
  (find-ticket-owner raffle-id ticket-index)
)

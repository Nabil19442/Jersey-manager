# Security Specification: JerseyFlow

## Data Invariants
1. Orders must have a valid quantity (>0) and financial fields (sellingPrice, buyingCost) must be non-negative.
2. Inventory items must have a positive stock level or zero (not negative).
3. Expenses must have a positive amount.
4. All records must be associated with the `ownerId` of the creator.
5. Only the owner of a record can read, update, or delete it.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Theft**: Create an order with `ownerId` set to a different user's UID.
2. **Ghost Order**: Create an order without a `customerName`.
3. **Price Manipulation**: Update an order's `sellingPrice` to -100.
4. **ID Injection**: Create a document using a 2KB string as the ID.
5. **Unauthorized Read**: Attempt to 'get' an order that belongs to another `ownerId`.
6. **Shadow Field**: Update an order with an extra `isAdmin: true` field.
7. **Negative Stock**: Create inventory with `stockQuantity: -5`.
8. **Orphaned Order**: Create an order with an invalid date format.
9. **Spam Expense**: Create an expense with a 1MB `notes` string.
10. **Global Exposure**: Attempt to list orders without being signed in.
11. **Email Spoofing**: Attempt to access data by spoofing a non-verified email (if email checks were active).
12. **Immutable Violation**: Attempt to change the `createdAt` timestamp of an existing order.

## Testing Strategy
The rules will be verified using the default-deny pattern and strict validation helpers for each entity.

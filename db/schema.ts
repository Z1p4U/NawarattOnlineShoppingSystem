import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNo: text("order_no").notNull(),
    orderDate: text("order_date").notNull(),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    customerKey: text("customer_key").notNull(),
    salesperson: text("salesperson").notNull().default("Admin"),
    route: text("route").notNull(),
    initialBoxes: integer("initial_boxes").notNull().default(0),
    initialBundles: integer("initial_bundles").notNull().default(0),
    addonBoxes: integer("addon_boxes").notNull().default(0),
    addonBundles: integer("addon_bundles").notNull().default(0),
    deliveredBoxes: integer("delivered_boxes").notNull().default(0),
    deliveredBundles: integer("delivered_bundles").notNull().default(0),
    orderAmount: integer("order_amount").notNull().default(0),
    voucherAmount: integer("voucher_amount").notNull().default(0),
    voucherStatus: text("voucher_status").notNull().default("updated"),
    voucherUpdatedBy: text("voucher_updated_by").notNull().default(""),
    voucherUpdatedAt: text("voucher_updated_at").notNull().default(""),
    saleApproved: integer("sale_approved", { mode: "boolean" }).notNull().default(false),
    saleApprovedBy: text("sale_approved_by").notNull().default(""),
    saleApprovedAt: text("sale_approved_at").notNull().default(""),
    paidAmount: integer("paid_amount").notNull().default(0),
    saleOrderCount: integer("sale_order_count").notNull().default(1),
    warehouseStatus: text("warehouse_status").notNull().default("finished"),
    warehouseBatches: text("warehouse_batches").notNull().default("[]"),
    warehouseConfirmedBy: text("warehouse_confirmed_by").notNull().default(""),
    warehouseConfirmedAt: text("warehouse_confirmed_at").notNull().default(""),
    dispatchStatus: text("dispatch_status").notNull().default("packed"),
    deliveredAt: text("delivered_at").notNull().default(""),
    deliveryProofKey: text("delivery_proof_key").notNull().default(""),
    deliveryProofName: text("delivery_proof_name").notNull().default(""),
    deliveryProofType: text("delivery_proof_type").notNull().default(""),
    deliveryProofUploadedBy: text("delivery_proof_uploaded_by").notNull().default(""),
    deliveryProofUploadedAt: text("delivery_proof_uploaded_at").notNull().default(""),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    addonPending: integer("addon_pending", { mode: "boolean" }).notNull().default(false),
    packageInstruction: text("package_instruction").notNull().default(""),
    remark: text("remark").notNull().default(""),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("orders_day_customer_route_idx").on(table.orderDate, table.customerKey, table.route),
    index("orders_date_idx").on(table.orderDate),
    index("orders_status_idx").on(table.dispatchStatus),
  ],
);

export const appUsers = sqliteTable("app_users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull().default("viewer"),
  passwordHash: text("password_hash").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const operationalSettings = sqliteTable("operational_settings", {
  id: integer("id").primaryKey(),
  trialStartDate: text("trial_start_date").notNull().default("2026-10-18"),
  officialStartDate: text("official_start_date").notNull().default("2026-10-26"),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const purchaseOperationalSettings = sqliteTable("purchase_operational_settings", {
  id: integer("id").primaryKey(),
  trialStartDate: text("trial_start_date").notNull().default("2026-10-26"),
  officialStartDate: text("official_start_date").notNull().default("2026-10-26"),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const purchaseCutoverRuns = sqliteTable("purchase_cutover_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  previousStartDate: text("previous_start_date").notNull(),
  officialStartDate: text("official_start_date").notNull(),
  productGroupCount: integer("product_group_count").notNull(),
  sourceRequestCount: integer("source_request_count").notNull(),
  statusCounts: text("status_counts").notNull(),
  backupKey: text("backup_key").notNull(),
  backupSize: integer("backup_size").notNull().default(0),
  executedByEmail: text("executed_by_email").notNull(),
  executedByName: text("executed_by_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("purchase_cutover_runs_date_unique").on(table.officialStartDate),
  index("purchase_cutover_runs_created_idx").on(table.createdAt),
]);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull().default("system"),
    entityId: text("entity_id").notNull().default(""),
    summary: text("summary").notNull(),
    actorEmail: text("actor_email").notNull().default(""),
    actorName: text("actor_name").notNull().default(""),
    actorRole: text("actor_role").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull(),
    customerKey: text("customer_key").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    route: text("route").notNull().default("HTY Ways"),
    salesperson: text("salesperson").notNull().default("Admin"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customers_customer_key_unique").on(table.customerKey),
    index("customers_name_township_idx").on(table.customerName, table.township),
  ],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("order_events_order_idx").on(table.orderId)],
);

export const saleOrderItems = sqliteTable(
  "sale_order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    batchSequence: integer("batch_sequence").notNull().default(1),
    originalRowNumber: integer("original_row_number").notNull(),
    originalProductCode: text("original_product_code").notNull().default(""),
    originalDescription: text("original_description").notNull(),
    originalQuantity: text("original_quantity").notNull(),
    quantity: integer("quantity").notNull().default(0),
    originalUnit: text("original_unit").notNull().default(""),
    checkedUnit: text("checked_unit").notNull().default(""),
    originalSalePrice: text("original_sale_price").notNull().default(""),
    matchedProductCode: text("matched_product_code").notNull().default(""),
    matchedProductName: text("matched_product_name").notNull().default(""),
    matchStatus: text("match_status").notNull().default("unknown"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("pending"),
    pickedQuantity: integer("picked_quantity").notNull().default(0),
    checkedQuantity: integer("checked_quantity").notNull().default(-1),
    shortageQuantity: integer("shortage_quantity").notNull().default(0),
    resolutionNote: text("resolution_note").notNull().default(""),
    substituteProductCode: text("substitute_product_code").notNull().default(""),
    substituteProductName: text("substitute_product_name").notNull().default(""),
    substituteSku: text("substitute_sku").notNull().default(""),
    substituteSalePrice: integer("substitute_sale_price").notNull().default(0),
    substituteQuantity: integer("substitute_quantity").notNull().default(0),
    substitutionStatus: text("substitution_status").notNull().default("none"),
    substitutionReason: text("substitution_reason").notNull().default(""),
    substitutionProposedBy: text("substitution_proposed_by").notNull().default(""),
    substitutionProposedAt: text("substitution_proposed_at").notNull().default(""),
    substitutionConfirmedBy: text("substitution_confirmed_by").notNull().default(""),
    substitutionConfirmedAt: text("substitution_confirmed_at").notNull().default(""),
    substitutionReturnedBy: text("substitution_returned_by").notNull().default(""),
    substitutionReturnedAt: text("substitution_returned_at").notNull().default(""),
    substitutionReturnReason: text("substitution_return_reason").notNull().default(""),
    verifiedBy: text("verified_by").notNull().default(""),
    verifiedAt: text("verified_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sale_order_items_order_row_unique").on(table.orderId, table.batchSequence, table.originalRowNumber),
    index("sale_order_items_order_idx").on(table.orderId, table.batchSequence),
    index("sale_order_items_match_idx").on(table.matchStatus, table.fulfillmentStatus),
  ],
);

export const orderProductAdjustments = sqliteTable(
  "order_product_adjustments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    orderStatusBefore: text("order_status_before").notNull().default(""),
    orderStatusAfter: text("order_status_after").notNull().default(""),
    beforeValue: text("before_value").notNull().default("[]"),
    afterValue: text("after_value").notNull().default("[]"),
    changeSummary: text("change_summary").notNull().default(""),
    reason: text("reason").notNull(),
    warehouseRecheckRequired: integer("warehouse_recheck_required", { mode: "boolean" }).notNull().default(false),
    stockAdjustmentStatus: text("stock_adjustment_status").notNull().default("review_required"),
    packageAdjustmentStatus: text("package_adjustment_status").notNull().default("review_required"),
    financeAdjustmentStatus: text("finance_adjustment_status").notNull().default("review_required"),
    saleVrAdjustmentStatus: text("sale_vr_adjustment_status").notNull().default("review_required"),
    editedBy: text("edited_by").notNull(),
    editedAt: text("edited_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("order_product_adjustments_order_idx").on(table.orderId, table.editedAt),
  ],
);

export const productMaster = sqliteTable(
  "product_master",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productCode: text("product_code").notNull(),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull().default(""),
    salePrice: integer("sale_price").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("product_master_code_unique").on(table.productCode),
    index("product_master_name_idx").on(table.productName),
    index("product_master_sku_idx").on(table.sku),
    index("product_master_active_idx").on(table.active, table.productName),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientRole: text("recipient_role").notNull(),
    recipientEmail: text("recipient_email").notNull().default(""),
    title: text("title").notNull(),
    message: text("message").notNull(),
    targetTab: text("target_tab").notNull().default("dashboard"),
    sourceId: integer("source_id").notNull().default(0),
    actor: text("actor").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("notifications_role_created_idx").on(table.recipientRole, table.createdAt),
  ],
);

export const notificationReads = sqliteTable(
  "notification_reads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notificationId: integer("notification_id").notNull(),
    userEmail: text("user_email").notNull(),
    readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("notification_reads_user_unique").on(table.notificationId, table.userEmail),
    index("notification_reads_user_idx").on(table.userEmail),
  ],
);

export const departmentMessages = sqliteTable(
  "department_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    senderEmail: text("sender_email").notNull(),
    senderName: text("sender_name").notNull(),
    senderRole: text("sender_role").notNull(),
    recipientRole: text("recipient_role").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("department_messages_sender_idx").on(table.senderRole, table.createdAt),
    index("department_messages_recipient_idx").on(table.recipientRole, table.createdAt),
  ],
);

export const departmentMessageReads = sqliteTable(
  "department_message_reads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id").notNull(),
    userEmail: text("user_email").notNull(),
    readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("department_message_reads_user_unique").on(table.messageId, table.userEmail),
    index("department_message_reads_user_idx").on(table.userEmail),
  ],
);

export const paymentTransactions = sqliteTable(
  "payment_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().default(0),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    amount: integer("amount").notNull().default(0),
    method: text("method").notNull(),
    paymentDate: text("payment_date").notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("payment_transactions_date_idx").on(table.paymentDate),
    index("payment_transactions_customer_idx").on(table.customerName, table.paymentDate),
  ],
);

export const paymentImportBatches = sqliteTable(
  "payment_import_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileHash: text("file_hash").notNull(),
    fileName: text("file_name").notNull().default(""),
    rowCount: integer("row_count").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    importedBy: text("imported_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("payment_import_batches_file_hash_unique").on(table.fileHash),
    index("payment_import_batches_created_idx").on(table.createdAt),
  ],
);

export const deliveryIncidents = sqliteTable(
  "delivery_incidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    issueType: text("issue_type").notNull(),
    itemDetails: text("item_details").notNull().default(""),
    deductionAmount: integer("deduction_amount").notNull().default(0),
    voucherBefore: integer("voucher_before").notNull().default(0),
    voucherAfter: integer("voucher_after").notNull().default(0),
    proofKey: text("proof_key").notNull(),
    proofName: text("proof_name").notNull().default(""),
    proofType: text("proof_type").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("delivery_incidents_order_idx").on(table.orderId, table.createdAt),
    index("delivery_incidents_type_idx").on(table.issueType, table.createdAt),
  ],
);

export const warehouseReturns = sqliteTable(
  "warehouse_returns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    returnedBoxes: integer("returned_boxes").notNull().default(0),
    returnedBundles: integer("returned_bundles").notNull().default(0),
    financeStatus: text("finance_status").notNull().default("not_deducted"),
    note: text("note").notNull().default(""),
    acceptedBy: text("accepted_by").notNull(),
    acceptedAt: text("accepted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("warehouse_returns_order_idx").on(table.orderId, table.acceptedAt),
    index("warehouse_returns_finance_idx").on(table.financeStatus, table.acceptedAt),
  ],
);

export const customerOpeningBalances = sqliteTable(
  "customer_opening_balances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    asOfDate: text("as_of_date").notNull().default("2026-10-20"),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    customerKey: text("customer_key").notNull(),
    openingPackages: integer("opening_packages").notNull().default(0),
    deliveredPackages: integer("delivered_packages").notNull().default(0),
    openingOutstanding: integer("opening_outstanding").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    note: text("note").notNull().default(""),
    enteredBy: text("entered_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customer_opening_balances_customer_unique").on(table.customerKey),
    index("customer_opening_balances_date_idx").on(table.asOfDate),
  ],
);

export const trialOpeningBalances = sqliteTable(
  "trial_opening_balances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    originalId: integer("original_id").notNull(),
    asOfDate: text("as_of_date").notNull(),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    customerKey: text("customer_key").notNull(),
    openingPackages: integer("opening_packages").notNull().default(0),
    deliveredPackages: integer("delivered_packages").notNull().default(0),
    openingOutstanding: integer("opening_outstanding").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    note: text("note").notNull().default(""),
    enteredBy: text("entered_by").notNull().default(""),
    originalCreatedAt: text("original_created_at").notNull().default(""),
    originalUpdatedAt: text("original_updated_at").notNull().default(""),
    archivedBy: text("archived_by").notNull().default("System"),
    archivedAt: text("archived_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("trial_opening_balances_original_unique").on(table.originalId),
    index("trial_opening_balances_customer_idx").on(table.customerKey, table.asOfDate),
  ],
);

export const purchaseRequests = sqliteTable(
  "purchase_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    batchSequence: integer("batch_sequence").notNull().default(1),
    productName: text("product_name").notNull(),
    productCode: text("product_code").notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default(""),
    supplierName: text("supplier_name").notNull().default(""),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("purchase_requests_order_idx").on(table.orderId),
    index("purchase_requests_status_idx").on(table.status),
  ],
);

export const customerPurchaseRequests = sqliteTable(
  "customer_purchase_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestDate: text("request_date").notNull(),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    customerKey: text("customer_key").notNull().default(""),
    productName: text("product_name").notNull(),
    productCode: text("product_code").notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default(""),
    supplierName: text("supplier_name").notNull().default(""),
    note: text("note").notNull().default(""),
    salesperson: text("salesperson").notNull().default(""),
    requestedByEmail: text("requested_by_email").notNull().default(""),
    sourceFileId: text("source_file_id").notNull().default(""),
    sourceFileName: text("source_file_name").notNull().default(""),
    aiConfidence: integer("ai_confidence").notNull().default(0),
    processingKey: text("processing_key"),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_purchase_requests_date_idx").on(table.requestDate),
    index("customer_purchase_requests_status_idx").on(table.status),
    index("customer_purchase_requests_customer_product_idx").on(table.customerKey, table.productCode, table.status),
    uniqueIndex("customer_purchase_requests_processing_key_unique").on(table.processingKey),
  ],
);

export const purchaseRequestAllocations = sqliteTable(
  "purchase_request_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceType: text("source_type").notNull(),
    purchaseRequestId: integer("purchase_request_id").notNull(),
    fulfillmentOrderId: integer("fulfillment_order_id").notNull(),
    fulfillmentOrderItemId: integer("fulfillment_order_item_id").notNull(),
    batchSequence: integer("batch_sequence").notNull().default(1),
    customerKey: text("customer_key").notNull(),
    productCode: text("product_code").notNull(),
    quantity: integer("quantity").notNull(),
    previousStatus: text("previous_status").notNull().default("pending"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").notNull().default("System"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    restoredBy: text("restored_by").notNull().default(""),
    restoredAt: text("restored_at").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("purchase_request_allocations_order_idx").on(table.fulfillmentOrderId, table.batchSequence, table.status),
    index("purchase_request_allocations_item_idx").on(table.fulfillmentOrderItemId, table.status),
    index("purchase_request_allocations_request_idx").on(table.sourceType, table.purchaseRequestId, table.status),
  ],
);

export const purchaseArrivalAllocations = sqliteTable(
  "purchase_arrival_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importRunId: integer("import_run_id").notNull(),
    incomingRecordId: integer("incoming_record_id").notNull().default(0),
    incomingUniqueKey: text("incoming_unique_key").notNull(),
    sourceType: text("source_type").notNull(),
    purchaseRequestId: integer("purchase_request_id").notNull(),
    canonicalProductId: integer("canonical_product_id").notNull().default(0),
    productCode: text("product_code").notNull().default(""),
    productName: text("product_name").notNull(),
    incomingQuantity: integer("incoming_quantity").notNull().default(0),
    allocatedQuantity: integer("allocated_quantity").notNull().default(0),
    requestedQuantity: integer("requested_quantity").notNull().default(0),
    remainingQuantity: integer("remaining_quantity").notNull().default(0),
    supplierName: text("supplier_name").notNull().default(""),
    purchaseDate: text("purchase_date").notNull().default(""),
    importedAt: text("imported_at").notNull(),
    matchedBy: text("matched_by").notNull().default(""),
    arrivalStatus: text("arrival_status").notNull().default("partial"),
    reviewReason: text("review_reason").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by").notNull().default("System"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("purchase_arrival_allocations_event_unique").on(table.importRunId, table.incomingUniqueKey, table.sourceType, table.purchaseRequestId),
    index("purchase_arrival_allocations_request_idx").on(table.sourceType, table.purchaseRequestId, table.status),
    index("purchase_arrival_allocations_run_idx").on(table.importRunId, table.status),
  ],
);

export const purchaseArrivalUnmatched = sqliteTable(
  "purchase_arrival_unmatched",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importRunId: integer("import_run_id").notNull(),
    incomingRecordId: integer("incoming_record_id").notNull().default(0),
    incomingUniqueKey: text("incoming_unique_key").notNull(),
    productCode: text("product_code").notNull().default(""),
    productName: text("product_name").notNull(),
    incomingQuantity: integer("incoming_quantity").notNull().default(0),
    supplierName: text("supplier_name").notNull().default(""),
    purchaseDate: text("purchase_date").notNull().default(""),
    importedAt: text("imported_at").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("unmatched"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("purchase_arrival_unmatched_event_unique").on(table.importRunId, table.incomingUniqueKey),
    index("purchase_arrival_unmatched_status_idx").on(table.status, table.importedAt),
  ],
);

export const saleOrderPhotos = sqliteTable(
  "sale_order_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    batchSequence: integer("batch_sequence").notNull().default(1),
    customerName: text("customer_name").notNull(),
    orderNo: text("order_no").notNull().default(""),
    orderDate: text("order_date").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull().default("image/webp"),
    fileSize: integer("file_size").notNull().default(0),
    downloadToken: text("download_token").notNull(),
    syncStatus: text("sync_status").notNull().default("pending"),
    driveFileId: text("drive_file_id").notNull().default(""),
    driveFileUrl: text("drive_file_url").notNull().default(""),
    syncError: text("sync_error").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull().default(""),
    uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    syncedAt: text("synced_at").notNull().default(""),
  },
  (table) => [
    index("sale_order_photos_sync_idx").on(table.syncStatus, table.uploadedAt),
    uniqueIndex("sale_order_photos_download_token_unique").on(table.downloadToken),
    index("sale_order_photos_order_idx").on(table.orderId, table.batchSequence),
  ],
);

export const productKnowledge = sqliteTable(
  "product_knowledge",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productName: text("product_name").notNull(),
    genericName: text("generic_name").notNull().default(""),
    category: text("category").notNull().default("General"),
    keyBenefits: text("key_benefits").notNull().default(""),
    talkingPoints: text("talking_points").notNull().default(""),
    usageNote: text("usage_note").notNull().default(""),
    caution: text("caution").notNull().default(""),
    tags: text("tags").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("product_knowledge_name_idx").on(table.productName),
    index("product_knowledge_category_idx").on(table.category, table.active),
  ],
);

export const productSyncRuns = sqliteTable(
  "product_sync_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    syncDate: text("sync_date").notNull(),
    saleTab: text("sale_tab").notNull().default(""),
    purchaseTab: text("purchase_tab").notNull().default(""),
    inventoryTab: text("inventory_tab").notNull().default(""),
    slowItemsTab: text("slow_items_tab").notNull().default(""),
    sourceSummary: text("source_summary").notNull().default("{}"),
    itemCount: integer("item_count").notNull().default(0),
    status: text("status").notNull().default("completed"),
    triggeredBy: text("triggered_by").notNull().default("Daily 10:00 AM Sync"),
    runType: text("run_type").notNull().default("daily"),
    sourceUrl: text("source_url").notNull().default(""),
    sourceRows: integer("source_rows").notNull().default(0),
    validCount: integer("valid_count").notNull().default(0),
    uniqueCount: integer("unique_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    lowSaleCount: integer("low_sale_count").notNull().default(0),
    overstockCount: integer("overstock_count").notNull().default(0),
    nearExpiredCount: integer("near_expired_count").notNull().default(0),
    unclassifiedCount: integer("unclassified_count").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    unchangedCount: integer("unchanged_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    errorSummary: text("error_summary").notNull().default("[]"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    completedAt: text("completed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("product_sync_runs_date_idx").on(table.syncDate, table.createdAt),
    index("product_sync_runs_active_idx").on(table.isActive, table.createdAt),
  ],
);

export const productIntelligence = sqliteTable(
  "product_intelligence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    syncRunId: integer("sync_run_id").notNull(),
    insightType: text("insight_type").notNull(),
    productCode: text("product_code").notNull().default(""),
    productName: text("product_name").notNull(),
    metricLabel: text("metric_label").notNull().default(""),
    metricValue: text("metric_value").notNull().default(""),
    details: text("details").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    priority: text("priority").notNull().default("normal"),
    rank: integer("rank").notNull().default(0),
    uniqueKey: text("unique_key").notNull().default(""),
    sourceRowNumber: integer("source_row_number").notNull().default(0),
    entryDate: text("entry_date").notNull().default(""),
    enteredBy: text("entered_by").notNull().default(""),
    expiryDate: text("expiry_date").notNull().default(""),
    knowledgeLocation: text("knowledge_location").notNull().default(""),
    checkedTime: text("checked_time").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("product_intelligence_run_idx").on(table.syncRunId, table.insightType, table.rank),
    index("product_intelligence_product_idx").on(table.productCode, table.productName),
    index("product_intelligence_unique_idx").on(table.syncRunId, table.uniqueKey),
    index("product_intelligence_location_idx").on(table.syncRunId, table.knowledgeLocation),
  ],
);

export const employeeReports = sqliteTable(
  "employee_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportDate: text("report_date").notNull(),
    reportType: text("report_type").notNull().default("daily"),
    title: text("title").notNull(),
    completedWork: text("completed_work").notNull().default(""),
    challenges: text("challenges").notNull().default(""),
    nextPlan: text("next_plan").notNull().default(""),
    supportNeeded: text("support_needed").notNull().default(""),
    submittedByEmail: text("submitted_by_email").notNull(),
    submittedByName: text("submitted_by_name").notNull(),
    submittedByRole: text("submitted_by_role").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("employee_reports_date_idx").on(table.reportDate, table.createdAt),
    index("employee_reports_employee_idx").on(table.submittedByEmail, table.reportDate),
  ],
);

export const salesFollowUps = sqliteTable(
  "sales_follow_ups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerKey: text("customer_key").notNull(),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    salesperson: text("salesperson").notNull().default("Admin"),
    opportunityType: text("opportunity_type").notNull().default("follow_up"),
    status: text("status").notNull().default("planned"),
    callDate: text("call_date").notNull().default(""),
    callTime: text("call_time").notNull().default(""),
    callPurpose: text("call_purpose").notNull().default("customer_follow_up"),
    callResult: text("call_result").notNull().default("planned"),
    nextFollowUpDate: text("next_follow_up_date").notNull().default(""),
    productSuggestion: text("product_suggestion").notNull().default(""),
    paymentFollowUp: text("payment_follow_up").notNull().default(""),
    customerRequest: text("customer_request").notNull().default(""),
    note: text("note").notNull().default(""),
    expectedAmount: integer("expected_amount").notNull().default(0),
    orderExpected: integer("order_expected", { mode: "boolean" }).notNull().default(false),
    confirmedOrderId: integer("confirmed_order_id"),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sales_follow_ups_customer_idx").on(table.customerKey, table.updatedAt),
    index("sales_follow_ups_next_date_idx").on(table.nextFollowUpDate, table.status),
    index("sales_follow_ups_salesperson_idx").on(table.salesperson, table.status),
  ],
);

export const customerLocations = sqliteTable(
  "customer_locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerKey: text("customer_key").notNull(),
    latitude: text("latitude").notNull().default(""),
    longitude: text("longitude").notNull().default(""),
    landmark: text("landmark").notNull().default(""),
    directionsNote: text("directions_note").notNull().default(""),
    shopPhotoUrl: text("shop_photo_url").notNull().default(""),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    updatedBy: text("updated_by").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("customer_locations_customer_unique").on(table.customerKey)],
);

export const salesRoutePlans = sqliteTable(
  "sales_route_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planDate: text("plan_date").notNull(),
    routeName: text("route_name").notNull(),
    township: text("township").notNull().default(""),
    salesperson: text("salesperson").notNull(),
    plannedStartTime: text("planned_start_time").notNull().default(""),
    status: text("status").notNull().default("planned"),
    remark: text("remark").notNull().default(""),
    isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sales_route_plans_date_idx").on(table.planDate, table.status),
    index("sales_route_plans_salesperson_idx").on(table.salesperson, table.planDate),
  ],
);

export const salesRouteStops = sqliteTable(
  "sales_route_stops",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routePlanId: integer("route_plan_id").notNull(),
    sequence: integer("sequence").notNull().default(1),
    customerKey: text("customer_key").notNull(),
    customerName: text("customer_name").notNull(),
    township: text("township").notNull().default(""),
    route: text("route").notNull().default(""),
    salesperson: text("salesperson").notNull().default("Admin"),
    status: text("status").notNull().default("pending"),
    visitPurpose: text("visit_purpose").notNull().default("collect_order"),
    visitResult: text("visit_result").notNull().default(""),
    noOrderReason: text("no_order_reason").notNull().default(""),
    orderReceived: integer("order_received", { mode: "boolean" }).notNull().default(false),
    estimatedOrderAmount: integer("estimated_order_amount").notNull().default(0),
    confirmedOrderId: integer("confirmed_order_id"),
    paymentCollected: integer("payment_collected", { mode: "boolean" }).notNull().default(false),
    collectedAmount: integer("collected_amount").notNull().default(0),
    financeVerified: integer("finance_verified", { mode: "boolean" }).notNull().default(false),
    customerRequest: text("customer_request").notNull().default(""),
    nextFollowUpDate: text("next_follow_up_date").notNull().default(""),
    nextVisitDate: text("next_visit_date").notNull().default(""),
    remark: text("remark").notNull().default(""),
    checkInLatitude: text("check_in_latitude").notNull().default(""),
    checkInLongitude: text("check_in_longitude").notNull().default(""),
    checkInDistanceMeters: integer("check_in_distance_meters").notNull().default(0),
    checkInVerified: integer("check_in_verified", { mode: "boolean" }).notNull().default(false),
    checkInReason: text("check_in_reason").notNull().default(""),
    checkInAt: text("check_in_at").notNull().default(""),
    checkOutAt: text("check_out_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sales_route_stops_plan_idx").on(table.routePlanId, table.sequence),
    index("sales_route_stops_customer_idx").on(table.customerKey, table.updatedAt),
    index("sales_route_stops_follow_up_idx").on(table.nextFollowUpDate, table.status),
  ],
);

export const balanceAdjustments = sqliteTable("balance_adjustments", {
  id: text("id").primaryKey(),
  customerKey: text("customer_key").notNull(),
  amount: integer("amount").notNull(),
  adjustmentDate: text("adjustment_date").notNull(),
  reason: text("reason").notNull(),
  beforeBalance: integer("before_balance").notNull(),
  afterBalance: integer("after_balance").notNull(),
  reversalOf: text("reversal_of"),
  enteredBy: text("entered_by").notNull(),
  actorEmail: text("actor_email").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("balance_adjustments_customer_idx").on(table.customerKey), uniqueIndex("balance_adjustments_reversal_unique").on(table.reversalOf)]);

export const duplicateReviewDecisions = sqliteTable("duplicate_review_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  recordAId: integer("record_a_id").notNull(),
  recordBId: integer("record_b_id").notNull(),
  pairKey: text("pair_key").notNull(),
  decision: text("decision").notNull().default("review_later"),
  canonicalId: integer("canonical_id").notNull().default(0),
  note: text("note").notNull().default(""),
  decidedBy: text("decided_by").notNull().default(""),
  decidedAt: text("decided_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("duplicate_review_decisions_pair_unique").on(table.pairKey),
  index("duplicate_review_decisions_entity_idx").on(table.entityType, table.decision, table.decidedAt),
]);

export const dataQualityAliases = sqliteTable("data_quality_aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  canonicalRecordId: integer("canonical_record_id").notNull(),
  aliasRecordId: integer("alias_record_id").notNull(),
  aliasKey: text("alias_key").notNull().default(""),
  aliasName: text("alias_name").notNull().default(""),
  aliasDetails: text("alias_details").notNull().default("{}"),
  mergedBy: text("merged_by").notNull(),
  mergedAt: text("merged_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("data_quality_aliases_record_unique").on(table.entityType, table.aliasRecordId),
  index("data_quality_aliases_canonical_idx").on(table.entityType, table.canonicalRecordId),
]);

export const dataQualityMergeBackups = sqliteTable("data_quality_merge_backups", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  canonicalRecordId: integer("canonical_record_id").notNull(),
  duplicateRecordId: integer("duplicate_record_id").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("data_quality_merge_backups_entity_idx").on(table.entityType, table.createdAt),
]);

export const examCycles = sqliteTable("exam_cycles", {
  id: text("id").primaryKey(),
  cycleKey: text("cycle_key").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  opensAt: text("opens_at").notNull().default(""),
  closesAt: text("closes_at").notNull().default(""),
  priceFileName: text("price_file_name").notNull().default(""),
  supplierFileName: text("supplier_file_name").notNull().default(""),
  inventoryFileName: text("inventory_file_name").notNull().default(""),
  priceCount: integer("price_count").notNull().default(0),
  supplierCount: integer("supplier_count").notNull().default(0),
  inventoryCount: integer("inventory_count").notNull().default(0),
  publishedBy: text("published_by").notNull().default(""),
  publishedAt: text("published_at").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("exam_cycles_key_unique").on(table.cycleKey),
  index("exam_cycles_status_idx").on(table.status, table.opensAt),
]);

export const examQuestionPool = sqliteTable("exam_question_pool", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cycleId: text("cycle_id").notNull(),
  section: text("section").notNull(),
  productKey: text("product_key").notNull(),
  productName: text("product_name").notNull(),
  payloadJson: text("payload_json").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("exam_pool_cycle_section_product_unique").on(table.cycleId, table.section, table.productKey),
  index("exam_pool_cycle_section_idx").on(table.cycleId, table.section),
]);

export const examAttempts = sqliteTable("exam_attempts", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  level: text("level").notNull(),
  attemptType: text("attempt_type").notNull(),
  status: text("status").notNull().default("in_progress"),
  officialLockKey: text("official_lock_key"),
  startedAt: text("started_at").notNull(),
  deadlineAt: text("deadline_at").notNull(),
  submittedAt: text("submitted_at").notNull().default(""),
  allowedSeconds: integer("allowed_seconds").notNull(),
  questionsJson: text("questions_json").notNull(),
  answersJson: text("answers_json").notNull().default("{}"),
  fingerprint: text("fingerprint").notNull(),
  priceScore: integer("price_score").notNull().default(0),
  supplierScore: integer("supplier_score").notNull().default(0),
  inventoryScore: integer("inventory_score").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  percentage: integer("percentage").notNull().default(0),
  timeUsedSeconds: integer("time_used_seconds").notNull().default(0),
  resetOf: text("reset_of").notNull().default(""),
  resetReason: text("reset_reason").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("exam_attempts_official_lock_unique").on(table.officialLockKey),
  index("exam_attempts_user_idx").on(table.userEmail, table.createdAt),
  index("exam_attempts_cycle_level_idx").on(table.cycleId, table.level, table.status),
  index("exam_attempts_fingerprint_idx").on(table.cycleId, table.level, table.fingerprint),
]);

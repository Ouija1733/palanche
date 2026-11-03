export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Link between a transaction and a tag (row of transaction_tags). */
export interface TransactionTag {
  id: string;
  transactionId: string;
  tagId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

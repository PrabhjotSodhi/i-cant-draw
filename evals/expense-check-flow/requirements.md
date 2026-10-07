Draw how we check employee expenses.

Card statements with paid transactions and receipt uploads with photos and PDFs land in import jobs. The import jobs fill two records in the expense data store: transactions and receipts. Nothing links the two records today. A matcher we build links them by amount, date and merchant. An expense check agent compares each transaction with its matched receipt, and every expense gets a verdict. Flagged expenses go to the finance team.

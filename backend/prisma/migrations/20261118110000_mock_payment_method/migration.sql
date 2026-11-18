ALTER TABLE `payment_attempts`
  MODIFY `method` ENUM('HDFC', 'CHALLAN', 'CASH', 'MOCK') NOT NULL;

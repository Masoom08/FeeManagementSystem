-- AlterTable
ALTER TABLE `students` ADD COLUMN `hostel_rate_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `students_hostel_rate_id_idx` ON `students`(`hostel_rate_id`);

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_hostel_rate_id_fkey` FOREIGN KEY (`hostel_rate_id`) REFERENCES `hostel_rates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

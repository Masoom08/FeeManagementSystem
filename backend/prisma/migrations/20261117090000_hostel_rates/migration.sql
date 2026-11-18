-- CreateTable
CREATE TABLE `hostel_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `condition` VARCHAR(10) NOT NULL,
    `occupancy` VARCHAR(30) NOT NULL,
    `annual_fee` INTEGER NOT NULL,

    UNIQUE INDEX `hostel_rates_condition_occupancy_key`(`condition`, `occupancy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

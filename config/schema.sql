-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 24, 2026 at 03:50 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.0.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sedayaclick`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendances`
--

CREATE TABLE IF NOT EXISTS `attendances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `attendance_date` date NOT NULL,
  `clock_in_time` datetime DEFAULT NULL,
  `clock_in_photo` varchar(255) DEFAULT NULL,
  `clock_in_lat` decimal(10,7) DEFAULT NULL,
  `clock_in_lng` decimal(10,7) DEFAULT NULL,
  `clock_in_note` text DEFAULT NULL,
  `clock_out_time` datetime DEFAULT NULL,
  `clock_out_photo` varchar(255) DEFAULT NULL,
  `clock_out_lat` decimal(10,7) DEFAULT NULL,
  `clock_out_lng` decimal(10,7) DEFAULT NULL,
  `clock_out_note` text DEFAULT NULL,
  `work_duration_seconds` int(11) DEFAULT NULL COMMENT 'Durasi kerja dalam detik, dihitung saat clock out',
  `late_duration_seconds` int(11) DEFAULT 0 COMMENT 'Durasi keterlambatan dalam detik',
  `overtime_seconds` int(11) DEFAULT 0 COMMENT 'Durasi lembur dalam detik',
  `status` enum('on_time','late','early_leave','incomplete') NOT NULL DEFAULT 'incomplete',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `overtime_clock_in_time` datetime DEFAULT NULL,
  `overtime_clock_out_time` datetime DEFAULT NULL,
  `overtime_clock_in_photo` varchar(255) DEFAULT NULL,
  `overtime_clock_out_photo` varchar(255) DEFAULT NULL,
  `overtime_clock_in_lat` decimal(10,7) DEFAULT NULL,
  `overtime_clock_in_lng` decimal(10,7) DEFAULT NULL,
  `overtime_clock_out_lat` decimal(10,7) DEFAULT NULL,
  `overtime_clock_out_lng` decimal(10,7) DEFAULT NULL,
  `overtime_task_reason` text DEFAULT NULL,
  `overtime_clock_in_note` text DEFAULT NULL,
  `overtime_clock_out_note` text DEFAULT NULL,
  `overtime_duration_seconds` int(11) DEFAULT 0,
  `overtime_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `overtime_review_note` text DEFAULT NULL,
  `overtime_reviewed_by` int(11) DEFAULT NULL,
  `overtime_reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`,`attendance_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `attendances`
-- (Clean for production)

-- --------------------------------------------------------

--
-- Table structure for table `divisions`
--

CREATE TABLE IF NOT EXISTS `divisions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `divisions`
--

INSERT IGNORE INTO `divisions` (`id`, `name`, `created_at`, `updated_at`) VALUES
(1, 'Head Office', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(2, 'Operasional', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(3, 'Marketing', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(4, 'IT', '2026-09-16 04:20:23', '2026-09-16 04:20:23');

-- --------------------------------------------------------

--
-- Table structure for table `positions`
--

CREATE TABLE IF NOT EXISTS `positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `positions`
--

INSERT IGNORE INTO `positions` (`id`, `name`, `created_at`, `updated_at`) VALUES
(1, 'Staff', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(2, 'Supervisor', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(3, 'Manager', '2026-09-16 02:13:34', '2026-09-16 02:13:34'),
(4, 'Multimedia', '2026-09-16 02:26:30', '2026-09-16 02:26:30');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shift_settings`
--

CREATE TABLE IF NOT EXISTS `shift_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `start_time` time NOT NULL DEFAULT '08:00:00',
  `end_time` time NOT NULL DEFAULT '17:00:00',
  `tolerance_minutes` int(11) NOT NULL DEFAULT 0 COMMENT 'Toleransi keterlambatan dalam menit',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shift_settings`
--

INSERT IGNORE INTO `shift_settings` (`id`, `name`, `start_time`, `end_time`, `tolerance_minutes`, `is_active`, `created_at`, `updated_at`) VALUES
(2, 'Reguler', '08:00:00', '17:00:00', 15, 1, '2026-09-21 02:32:27', '2026-09-21 02:32:27'),
(3, 'test', '08:00:00', '17:00:00', 180, 1, '2026-09-21 02:34:00', '2026-09-21 02:34:00');

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE IF NOT EXISTS `submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('izin','cuti','sakit','lembur') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `reason` text NOT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `handover_plan` text DEFAULT NULL,
  `handover_to_name` varchar(255) DEFAULT NULL,
  `handover_to_position` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_sub_user` (`user_id`),
  KEY `fk_sub_reviewer` (`reviewed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `submissions`
--

INSERT IGNORE INTO `submissions` (`id`, `user_id`, `type`, `start_date`, `end_date`, `start_time`, `end_time`, `reason`, `attachment`, `status`, `reviewed_by`, `review_note`, `reviewed_at`, `created_at`, `updated_at`, `handover_plan`, `handover_to_name`, `handover_to_position`) VALUES
(11, 13, 'cuti', '2026-09-12', '2026-09-15', NULL, NULL, 'das', '/uploads/submissions/submissions-1790140669344-852330022.jpg', 'approved', 12, 'h i Disetujui', '2026-09-23 20:50:30', '2026-09-23 05:17:49', '2026-09-23 13:50:30', 'daus', 'daus', 'daus');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `whatsapp` varchar(30) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `position_id` int(11) DEFAULT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `role` enum('employee','admin_manager','super_admin') NOT NULL DEFAULT 'employee',
  `status` enum('pending','active','inactive') NOT NULL DEFAULT 'pending',
  `photo_profile` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_division` (`division_id`),
  KEY `fk_users_position` (`position_id`),
  KEY `fk_users_shift` (`shift_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT IGNORE INTO `users` (`id`, `full_name`, `email`, `password`, `whatsapp`, `address`, `division_id`, `position_id`, `shift_id`, `role`, `status`, `photo_profile`, `created_at`, `updated_at`) VALUES
(2, 'Super Admin', 'superadmin@sedayaclick.local', '$2a$10$rjq1mgBNtRH1vZv2goBHoebOlgjQ2RWMphorn3C1kjYcf1ay1465y', NULL, NULL, NULL, NULL, NULL, 'super_admin', 'active', NULL, '2026-09-16 02:24:30', '2026-09-16 02:24:30'),
(4, 'daus', 'firdausmila664@gmail.com', '$2a$10$Z4Py8k/oPqyrvCW9xVQNEejZNb/pl/NgxolZ2m1QLaHb4bVq5r3WW', '085924518195', 'jl', NULL, NULL, NULL, 'employee', 'active', NULL, '2026-09-16 04:27:15', '2026-09-20 08:29:43'),
(5, 'Super Admin', 'admin@gmail.com', '$2a$10$Uw5/P2ifH/9udfu6Z8gFgurOiNTUcBGf3xfq/sko6v2cd4xDumXyC', NULL, NULL, NULL, NULL, NULL, 'super_admin', 'active', NULL, '2026-09-17 04:42:26', '2026-09-17 04:42:26'),
(8, 'cobacoba', 'cobacoba@gmail.com', '$2a$10$Z1YX9XEL4VjI/zD.TAQDvOZWnZdHNKezb0e8otEdkZFTKYf4mbnOW', '0812345567', 'cikampret', NULL, NULL, NULL, 'employee', 'active', NULL, '2026-09-17 15:10:43', '2026-09-17 15:10:43'),
(12, 'Adit', 'adit@gmail.com', '$2a$10$ngZ5SFY5wMgtvUB4C7cuY.qKg9KGxVLs.NQcHyzD/dI3oDn0Di6S2', '08589220298', 'Pu', 1, 3, NULL, 'admin_manager', 'active', NULL, '2026-09-18 06:53:33', '2026-09-18 06:53:33'),
(13, 'daus', 'daus@gmail.com', '$2a$10$vIdldk9ej34Yao3PKsVtaO3b/reCFCWU0V/wlj1RegKqJN83mqsW6', '08090', 'Jl', 4, 3, NULL, 'employee', 'active', NULL, '2026-09-20 16:29:23', '2026-09-20 16:29:49'),
(14, 'contoh', 'contoh@gmail.com', '$2a$10$WcpJCnJpMbzQQWjTKFgO.ewWbwDrOim8rgbvk/bwforXQMHaqtGVS', '88', 'jl', 4, 3, NULL, 'employee', 'active', NULL, '2026-09-21 02:28:48', '2026-09-21 02:34:25'),
(15, 'mas adit', 'adit321@gmail.com', '$2a$10$cBFPLYFXfT0UHCoOW6RNCOdHYoUo5ZdsU.p7X6zpEb4.4wo9Ztpem', '09', 'jl', 3, 3, NULL, 'employee', 'active', NULL, '2026-09-21 03:02:48', '2026-09-21 03:03:59');

--
-- Structure for view `view_attendance_report`
--
CREATE OR REPLACE VIEW `view_attendance_report` AS 
SELECT `a`.`id` AS `attendance_id`, `u`.`id` AS `user_id`, `u`.`full_name` AS `full_name`, `d`.`name` AS `division_name`, `p`.`name` AS `position_name`, `a`.`attendance_date` AS `attendance_date`, `a`.`clock_in_time` AS `clock_in_time`, `a`.`clock_out_time` AS `clock_out_time`, sec_to_time(ifnull(`a`.`work_duration_seconds`,0)) AS `work_duration_hms`, sec_to_time(ifnull(`a`.`late_duration_seconds`,0)) AS `late_duration_hms`, sec_to_time(ifnull(`a`.`overtime_seconds`,0)) AS `overtime_hms`, `a`.`status` AS `status`, `a`.`clock_in_note` AS `clock_in_note`, `a`.`clock_out_note` AS `clock_out_note` 
FROM (((`attendances` `a` join `users` `u` on(`u`.`id` = `a`.`user_id`)) left join `divisions` `d` on(`d`.`id` = `u`.`division_id`)) left join `positions` `p` on(`p`.`id` = `u`.`position_id`));

--
-- Structure for view `view_submission_report`
--
CREATE OR REPLACE VIEW `view_submission_report` AS 
SELECT `s`.`id` AS `submission_id`, `u`.`id` AS `user_id`, `u`.`full_name` AS `full_name`, `d`.`name` AS `division_name`, `s`.`type` AS `type`, `s`.`start_date` AS `start_date`, `s`.`end_date` AS `end_date`, to_days(`s`.`end_date`) - to_days(`s`.`start_date`) + 1 AS `total_days`, `s`.`status` AS `status`, `s`.`reason` AS `reason`, `reviewer`.`full_name` AS `reviewed_by_name`, `s`.`reviewed_at` AS `reviewed_at` 
FROM (((`submissions` `s` join `users` `u` on(`u`.`id` = `s`.`user_id`)) left join `divisions` `d` on(`d`.`id` = `u`.`division_id`)) left join `users` `reviewer` on(`reviewer`.`id` = `s`.`reviewed_by`));

--
-- Constraints for dumped tables
--

ALTER TABLE `attendances`
  ADD CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `submissions`
  ADD CONSTRAINT `fk_sub_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_users_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_users_shift` FOREIGN KEY (`shift_id`) REFERENCES `shift_settings` (`id`) ON DELETE SET NULL;

COMMIT;
CREATE DATABASE IF NOT EXISTS reservations_db;
USE reservations_db;

CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  salle_id INT,
  reservation_date DATETIME,
  duration INT,
  status ENUM('confirmed', 'pending', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

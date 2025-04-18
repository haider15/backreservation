CREATE TABLE IF NOT EXISTS users (
   id INT AUTO_INCREMENT PRIMARY KEY,
   email VARCHAR(255) NOT NULL,
   google_id VARCHAR(255) UNIQUE,
   auth_provider VARCHAR(50) NOT NULL,
   password VARCHAR(255),
   role VARCHAR(20) DEFAULT 'visitor',  -- Rôle de l'utilisateur (admin, employee, visitor)
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertion d'un utilisateur avec un mot de passe local
INSERT INTO users (email, google_id, auth_provider, password, role)
VALUES ('admin@gmail.com', NULL, 'local', 'admin123', 'admin');

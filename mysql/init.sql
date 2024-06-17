-- mysql/init.sql
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE DailyTodos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    type ENUM('yes_no', 'quantity') NOT NULL,
    date DATE NOT NULL,
    status INT DEFAULT 0,
    goal INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

-- Insert the test user
INSERT INTO Users (id, username, email, password_hash) VALUES (1, 'raza', 'raza.mobin@gmail.com', 'hashed_password');

INSERT INTO `DailyTodos` VALUES (1,1,'eat bfast before 10:30am','yes_no','2024-06-17',0,0,'2024-06-17 05:47:00','2024-06-17 05:47:00'),(2,1,'meds 1','yes_no','2024-06-17',1,0,'2024-06-17 05:47:12','2024-06-17 05:47:53'),(3,1,'gym ','yes_no','2024-06-17',0,0,'2024-06-17 05:47:15','2024-06-17 05:47:15'),(4,1,'3 proper meals','yes_no','2024-06-17',1,0,'2024-06-17 05:47:24','2024-06-17 05:47:52'),(5,1,'# of focused 25min timers','quantity','2024-06-17',5,12,'2024-06-17 05:47:44','2024-06-17 05:59:13'),(6,1,'dsp','yes_no','2024-06-17',1,0,'2024-06-17 05:48:02','2024-06-17 05:48:04'),(7,1,'blue blockers 8pm ','yes_no','2024-06-17',1,0,'2024-06-17 05:48:21','2024-06-17 05:48:44'),(8,1,'meds 2','yes_no','2024-06-17',1,0,'2024-06-17 05:48:27','2024-06-17 13:37:58'),(9,1,'close laptop by 11pm','yes_no','2024-06-17',1,0,'2024-06-17 05:48:34','2024-06-17 05:54:57');

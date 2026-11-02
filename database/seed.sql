-- Insert sample users
INSERT INTO users (id, username, real_name, email, password_hash, avatar_color, is_online) VALUES
('user1', 'alice', 'Alice Johnson', 'alice@example.com', '$2a$10$samplehash1', '#FF6B6B', 1),
('user2', 'bob', 'Bob Smith', 'bob@example.com', '$2a$10$samplehash2', '#4ECDC4', 1),
('user3', 'charlie', 'Charlie Brown', 'charlie@example.com', '$2a$10$samplehash3', '#45B7D1', 0),
('user4', 'diana', 'Diana Prince', 'diana@example.com', '$2a$10$samplehash4', '#96CEB4', 1);

-- Insert sample group
INSERT INTO groups (id, name, creator_id) VALUES
('group1', 'General Chat', 'user1');

-- Add group members
INSERT INTO group_members (group_id, user_id) VALUES
('group1', 'user1'),
('group1', 'user2'),
('group1', 'user3');

-- Insert sample messages
INSERT INTO messages (id, sender_id, receiver_id, content, is_read, expires_at) VALUES
('msg1', 'user1', 'user2', 'Hey Bob, how are you?', 1, datetime('now', '+1 day')),
('msg2', 'user2', 'user1', 'Hi Alice! I''m good, thanks!', 1, datetime('now', '+1 day')),
('msg3', 'user1', 'user2', 'Want to chat?', 0, datetime('now', '+1 day'));

-- Insert sample network hosts
INSERT INTO network_hosts (id, user_id, host_ip, host_port) VALUES
('host1', 'user1', '192.168.1.101', 5000),
('host2', 'user2', '192.168.1.102', 5000),
('host4', 'user4', '192.168.1.104', 5000);

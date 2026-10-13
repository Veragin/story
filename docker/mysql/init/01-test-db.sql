-- Dev only: the integration tests run against `story_test` (plan D9), next to the app's `story`.
CREATE DATABASE IF NOT EXISTS `story_test`;
GRANT ALL PRIVILEGES ON `story_test`.* TO 'story'@'%';

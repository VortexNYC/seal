DROP INDEX IF EXISTS `member_org_user_idx`;
CREATE UNIQUE INDEX `member_organizationId_userId_unique` ON `member` (`organization_id`, `user_id`);

CREATE TABLE `action_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int,
	`agentId` enum('economia','carrera','salud','relaciones','familia','guardian','sala_juntas') NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`priority` enum('alta','media','baja') NOT NULL DEFAULT 'media',
	`status` enum('pendiente','en_progreso','completada','cancelada') NOT NULL DEFAULT 'pendiente',
	`deadline` timestamp,
	`completedAt` timestamp,
	`sourceMessageId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` enum('economia','carrera','salud','relaciones','familia','guardian','sala_juntas') NOT NULL,
	`title` varchar(255),
	`messageCount` int NOT NULL DEFAULT 0,
	`summary` text,
	`lastSummaryAt` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` enum('economia','carrera','salud','relaciones','familia','guardian','sala_juntas') NOT NULL,
	`content` text NOT NULL,
	`importance` enum('alta','media','baja') NOT NULL DEFAULT 'media',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`agentId` enum('economia','carrera','salud','relaciones','familia','guardian','sala_juntas'),
	`structuredData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vault` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`financialStatus` json,
	`careerData` json,
	`healthMetrics` json,
	`relationshipStatus` json,
	`familyCircle` json,
	`valuesFramework` json,
	`personalInfo` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vault_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `guardianEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `guardianFramework` varchar(128);
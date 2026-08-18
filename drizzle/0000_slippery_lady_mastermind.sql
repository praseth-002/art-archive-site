CREATE TABLE `artworks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`year` text DEFAULT '' NOT NULL,
	`medium` text DEFAULT '' NOT NULL,
	`collection_name` text DEFAULT 'Unsorted' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_key` text NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

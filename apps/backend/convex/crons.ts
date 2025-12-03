import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process email retries every 5 minutes
crons.interval(
	"process-email-retries",
	{ minutes: 5 },
	internal.emails.email_retry.processEmailRetries,
);

export default crons;

/**
 * Zapier App & Event Reference
 * Used as context when generating Zapier workflow JSON and build plans.
 */
export const ZAPIER_APP_REFERENCE = `
## Zapier App & Event Reference

### How Zaps Work
- Every Zap starts with exactly ONE trigger (Step 1)
- Followed by one or more action steps (Steps 2, 3, 4...)
- Data flows forward only: later steps can reference earlier step outputs via {{stepN.fieldName}}
- Filters stop execution if conditions aren't met (do NOT count as a task when they stop the Zap)
- Paths create conditional branches (like if/else) — requires Professional plan
- No loops by default — use Looping by Zapier for iteration

### Trigger Apps & Events

**Webhooks by Zapier**
- Catch Hook — Receives POST/GET requests at a unique Zapier URL
- Catch Raw Hook — Receives raw body (for non-JSON payloads)

**Schedule by Zapier**
- Every Day — Triggers daily at specified time
- Every Week — Triggers weekly
- Every Month — Triggers monthly
- Every Hour — Triggers hourly

**Google Sheets** — New Spreadsheet Row, New or Updated Spreadsheet Row
**Gmail** — New Email, New Labeled Email, New Attachment, New Thread
**Slack** — New Message Posted to Channel, New Mention, New Reaction Added
**HubSpot** — New Contact, New Deal, New Form Submission, Updated Contact, New Ticket
**Salesforce** — New Record, Updated Record, New Outbound Message
**Pipedrive** — New Deal, Updated Deal, New Person, New Activity, Updated Person
**Stripe** — New Payment, New Customer, New Subscription, Failed Payment, New Invoice
**Shopify** — New Order, New Customer, New Product, Updated Order, Cancelled Order
**Typeform** — New Entry
**Calendly** — Invitee Created, Invitee Canceled
**Airtable** — New Record, New or Updated Record, New Record in View
**Notion** — New Database Item, Updated Database Item, New Page
**Google Forms** — New Form Response, New or Updated Response
**Facebook Lead Ads** — New Lead
**Jotform** — New Submission
**WooCommerce** — New Order, New Customer, Updated Order
**GitHub** — New Pull Request, New Issue, New Commit, New Branch
**Intercom** — New Conversation, New User, User Tag Added
**ClickUp** — New Task, Task Status Change
**Asana** — New Task, Task Completed
**Trello** — New Card, Card Moved to List

### Action Apps & Events

**Google Sheets** — Create Spreadsheet Row, Update Spreadsheet Row, Lookup Spreadsheet Row, Create Spreadsheet, Delete Spreadsheet Row
**Gmail** — Send Email, Create Draft, Add Label, Reply to Email, Remove Label
**Slack** — Send Channel Message, Send Direct Message, Create Channel, Set Status, Add Reaction, Update Message, Upload File
**OpenAI (GPT, DALL-E, Whisper)** [PREMIUM]
- Send Prompt (Chat Completion), Create Image, Create Transcription, Create Translation, Send Prompt with Vision

**HubSpot** [PREMIUM for Marketing Hub]
- Create Contact, Update Contact, Create Deal, Update Deal, Create Ticket, Create Company, Add Contact to List, Create Engagement

**Salesforce** [PREMIUM]
- Create Record, Update Record, Find Record, Add Record to Campaign

**Pipedrive** — Create Deal, Update Deal, Create Person, Update Person, Create Activity, Create Note, Create Organization

**Mailchimp** — Add/Update Subscriber, Send Campaign, Create Campaign, Tag Subscriber, Remove Tag, Archive Subscriber
**SendGrid** — Send Email, Add/Update Contact, Create Contact List
**Twilio** — Send SMS, Make Call, Send WhatsApp Message

**Asana** — Create Task, Update Task, Create Project, Add Comment, Create Subtask
**Trello** — Create Card, Move Card to List, Add Comment, Create Label, Archive Card
**Notion** — Create Database Item, Update Database Item, Append Block to Page, Create Page
**ClickUp** — Create Task, Update Task, Create List, Create Subtask, Add Comment
**Monday.com** — Create Item, Update Item, Create Update
**Linear** — Create Issue, Update Issue, Create Comment
**Jira** — Create Issue, Update Issue, Add Comment, Transition Issue

**Airtable** — Create Record, Update Record, Find Record, Delete Record
**Google Drive** — Upload File, Create Folder, Move File, Copy File, Create File from Text
**Google Docs** — Create Document from Template, Append Text to Document, Create Document
**Google Calendar** — Create Detailed Event, Quick Add Event, Find Event, Update Event

**Stripe** [PREMIUM] — Create Customer, Create Charge, Create Invoice, Create Subscription, Update Customer
**Shopify** [PREMIUM] — Create Order, Update Order, Create Product, Update Product

**Webhook by Zapier** — POST, GET, PUT, Custom Request (for APIs without native Zapier integration)

**Formatter by Zapier** (Built-in utility)
- Text: Transform (capitalize, lowercase, titlecase, trim, truncate, find/replace, split)
- Text: Extract (extract pattern, extract URL, extract email, extract number)
- Numbers: Perform Math (add, subtract, multiply, divide, random number)
- Date/Time: Format (parse date, format date, add/subtract time, compare dates)
- Utilities: Lookup Table, Choose Value, Line Itemizer, Pick from List
- Utilities: Convert Markdown to HTML, Convert HTML to Markdown

**Filter by Zapier** (Built-in)
- Only Continue If... (text contains, number greater than, date before, exists, etc.)
- Multiple conditions with AND/OR logic

**Paths by Zapier** (Built-in, requires Professional plan)
- Path A / Path B / Path C — Conditional branching with different rules per path
- Each path can have its own chain of subsequent steps

**Delay by Zapier** (Built-in)
- Delay For — Pause for specified duration (minutes, hours, days)
- Delay Until — Pause until specific date/time

**Looping by Zapier** (Built-in)
- Loop — Process each item in an array/list separately

**Code by Zapier** (Built-in)
- Run Javascript — Execute custom JS code with input variables
- Run Python — Execute custom Python code with input variables

**Storage by Zapier** (Built-in)
- Get Value — Retrieve a stored value by key
- Set Value — Store a value by key (persists across Zap runs)
- Increment Value — Increment a stored number

**Digest by Zapier** (Built-in)
- Append Entry and Schedule Digest — Collect entries and send batched summary on schedule

**Email Parser by Zapier** — Parse Email (extract structured data from incoming emails)

**Zendesk** — Create Ticket, Update Ticket, Create User, Add Comment
**Freshdesk** — Create Ticket, Update Ticket, Add Note
**Intercom** — Create/Update User, Send Message, Create Conversation, Tag User
**Discord** — Send Message to Channel, Send Direct Message

### Data Mapping Rules
- Reference earlier steps: {{stepN.fieldName}} (e.g., {{step1.email}}, {{step3.response}})
- Nested fields: {{step1.data.customer.email}}
- Filters use conditions: { field: "{{stepN.field}}", operator: "text_contains|number_greater_than|exists|not_exists|date_before|date_after", value: "comparison_value" }

### Zapier Plan Requirements
- Free: Single-step Zaps only, 5 Zaps, 100 tasks/month
- Starter: Multi-step, Filters, Formatter, 20 Zaps, 750 tasks/month
- Professional: Paths, Custom Logic, Webhooks, Unlimited Zaps, 2000 tasks/month
- Team/Company: Shared Zaps, Folders, Permissions, Unlimited Zaps

### Premium Apps (cost extra per task)
OpenAI, Salesforce, HubSpot (Marketing Hub), Shopify, Stripe, QuickBooks, Xero, NetSuite, Zendesk (Enterprise)

### Task Counting
- 1 task per trigger execution
- 1 task per action step that executes
- Filter steps that STOP execution do NOT count as a task
- Paths: only the matched path's steps count
- Loops: each iteration counts as separate tasks
`;

// This gets injected into the Claude prompt when building Make.com scenarios
export const MAKE_MODULE_REFERENCE = `
## Make.com Module Reference

### Module Naming Convention
All modules use the format: app-name:actionName
Example: google-sheets:addRow, openai:createChatCompletion, slack:sendMessage

### Data Mapping
Reference outputs from previous modules using: {{moduleId.fieldName}}
Example: Module 2 reads from Module 1: {{1.body}}, {{1.headers.content-type}}

### Module Categories

#### Triggers (Start a Scenario)
- webhook:customWebhook — Custom webhook trigger (receives POST/GET requests)
- google-sheets:watchRows — Triggers when new rows added
- gmail:watchEmails — Triggers on new emails matching criteria
- slack:watchMessages — Triggers on new messages in channels
- hubspot:watchContacts — Triggers on new/updated contacts
- salesforce:watchRecords — Triggers on new/updated records
- airtable:watchRecords — Triggers on new/updated records
- stripe:watchEvents — Triggers on payment events
- shopify:watchOrders — Triggers on new orders
- schedule:interval — Triggers on time interval
- typeform:watchResponses — Triggers on form submissions
- calendly:watchInvitees — Triggers on meeting bookings
- jotform:watchSubmissions — Triggers on form submissions

#### Google Suite
- google-sheets:addRow, updateRow, searchRows, getCell, clearRow, watchRows
- google-drive:uploadFile, downloadFile, createFolder, watchFiles, moveFile, copyFile
- google-docs:createDocument, appendText, replaceText, getDocument
- google-calendar:createEvent, updateEvent, watchEvents, listEvents, deleteEvent
- gmail:sendEmail, searchEmails, watchEmails, markAsRead, addLabel, createDraft

#### CRM
- hubspot:createContact, updateContact, createDeal, updateDeal, searchCRM, addNote
- salesforce:createRecord, updateRecord, searchRecords, deleteRecord, watchRecords
- pipedrive:createDeal, updateDeal, createPerson, updatePerson, addActivity, addNote

#### Communication
- slack:sendMessage, updateMessage, createChannel, uploadFile, addReaction, watchMessages
- twilio:sendSMS, makeCall, watchSMS
- sendgrid:sendEmail, addContact, createList, sendCampaign
- mailchimp:addSubscriber, updateSubscriber, sendCampaign, createCampaign, tagSubscriber
- discord:sendMessage, createChannel

#### AI
- openai:createChatCompletion, createImage, createEmbedding, createTranscription
- anthropic:createMessage

#### Project Management
- asana:createTask, updateTask, watchTasks, createProject, addComment
- trello:createCard, moveCard, watchCards, addComment, createList
- notion:createPage, updatePage, queryDatabase, watchPages, appendBlock
- clickup:createTask, updateTask, watchTasks, createList
- monday:createItem, updateItem, createUpdate
- linear:createIssue, updateIssue, createComment

#### Utilities (CRITICAL — these are Make.com's power features)
- http:makeRequest — Generic HTTP request (GET/POST/PUT/DELETE with full config)
- http:makeBasicAuthRequest — HTTP with basic auth
- http:makeOAuth2Request — HTTP with OAuth2
- json:parseJSON — Parse JSON string to object
- json:createJSON — Create JSON string from data
- json:transformJSON — Transform JSON structure
- csv:parseCSV — Parse CSV to array
- csv:createCSV — Create CSV from array
- text-parser:match — Regex match on text
- text-parser:replace — Regex replace on text
- text-parser:split — Split text into array
- text-parser:htmlToText — Strip HTML tags

#### Flow Control (CRITICAL — scenario branching and iteration)
- flow-control:router — Conditional branching (multiple output routes with filters)
- flow-control:iterator — Iterate over array items (processes each item separately)
- flow-control:aggregator — Aggregate items back into single bundle
- flow-control:sleep — Pause execution for specified duration
- flow-control:repeater — Repeat a set of modules N times
- tools:setVariable — Store a value for later use
- tools:getVariable — Retrieve a stored value
- tools:increment — Increment a numeric variable
- tools:switchFunction — Switch/case logic
- datastore:addRecord — Store data in Make data store
- datastore:updateRecord — Update record in data store
- datastore:searchRecords — Query data store
- datastore:deleteRecord — Delete from data store

#### Storage & Database
- airtable:createRecord, updateRecord, searchRecords, watchRecords, deleteRecord
- supabase:createRow, updateRow, searchRows, deleteRow
- aws-s3:uploadFile, downloadFile, listFiles, deleteFile
- dropbox:uploadFile, downloadFile, watchFiles

#### E-commerce
- shopify:createOrder, updateOrder, createProduct, updateProduct, watchOrders
- stripe:createCharge, createCustomer, createInvoice, createSubscription, watchPayments
- woocommerce:createOrder, updateOrder, watchOrders, createProduct

#### Documents
- docusign:sendEnvelope, watchEnvelopes
- pdf-co:mergePDF, splitPDF, convertHTML, fillForm
- cloudconvert:convertFile

### Blueprint Structure Rules

1. Module IDs are sequential integers starting at 1
2. Connections between modules are IMPLICIT by order in the flow array
3. Router creates parallel branches — each branch continues with its own module chain
4. Error handlers attach via metadata: { "errorHandler": true, "fallback": moduleId }
5. Designer coordinates: space modules ~300px apart on x-axis, y=150 for main flow
6. Scenario metadata MUST include: roundtrips, maxErrors, autoCommit, sequential, confidential, dataloss
7. Placeholder credentials use: {{CONNECTION_NAME}} format
8. Every module MUST have: id, module, version, parameters, mapper, metadata
9. Router filters go in the mapper: { "filter": { "conditions": [[{ "a": "{{1.field}}", "o": "equal", "b": "value" }]] } }
10. Iterator input goes in mapper: { "array": "{{1.data}}" }
11. Aggregator groups by source module: { "source": 3, "value": "{{3.item}}" }
`;

export const MAKE_BLUEPRINT_TEMPLATE = {
  name: '',
  flow: [],
  metadata: {
    version: 1,
    scenario: {
      roundtrips: 1,
      maxErrors: 3,
      autoCommit: true,
      autoCommitTriggerLast: true,
      sequential: false,
      confidential: false,
      dataloss: false,
    },
    designer: { orphans: [] },
  },
};

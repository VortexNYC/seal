# Advanced Field Types - User Flows

## Primary Advanced Field Creation Flows

### Adding Advanced Fields to Document

```
○ User in Field Placement Mode with Recipients Configured
    ↓
□ User Selects Advanced Field Type
    ├─ Field palette shows: Signature, Date, Text, Dropdown, Radio, Number, Checkbox
    ├─ User clicks on advanced field type (Dropdown, Radio, Number, or Checkbox)
    ├─ Advanced field configuration opens
    └─ User configures field properties before placement
    ↓
○ User Configures Advanced Field Properties
    ├─ Field name and description
    ├─ Required vs optional setting
    ├─ Field-specific options (dropdown choices, number ranges, etc.)
    └─ Recipient assignment (which signer completes this field)
    ↓
□ User Places Field on Document
    ├─ Click document location to place configured field
    ├─ Field appears on document with visual indicator of type
    ├─ Field assigned to specific recipient with color coding
    └─ Field ready for completion during signing process
    ↓
○ Advanced Field Added Successfully
    ├─ Field visible on document with proper formatting
    ├─ Field properties saved and ready for signing
    ├─ User can continue adding more fields or proceed to sending
    └─ Field appears in recipient's signing interface when document is sent
```

---

## Dropdown Field Flows

### Creating Dropdown Field Flow

```
○ User Selects Dropdown Field Type
    ↓
□ Dropdown Configuration Opens
    ├─ Field name: "Select your preferred option"
    ├─ Required/Optional toggle
    ├─ Dropdown options list (initially empty)
    └─ "Add Option" button to build choices
    ↓
○ User Adds Dropdown Options
    ├─ Click "Add Option" to create new choice
    ├─ Enter option text (e.g., "Option 1", "Red", "Small")
    ├─ Set default selection (optional)
    └─ Repeat to add multiple options
    ↓
□ User Manages Dropdown Options
    ├─ Reorder options by dragging
    ├─ Edit option text inline
    ├─ Delete options with confirmation
    └─ Minimum 2 options required for dropdown
    ↓
○ Dropdown Configuration Complete
    ├─ All options configured with clear labels
    ├─ Default selection set (if desired)
    ├─ Required/optional status confirmed
    └─ Ready to place on document
```

### Dropdown Field Completion During Signing

```
○ Recipient Encounters Dropdown Field During Signing
    ↓
□ Dropdown Interface Appears
    ├─ Field label shows purpose of dropdown
    ├─ Dropdown menu with all configured options
    ├─ Default option pre-selected (if configured)
    └─ Clear indication if field is required
    ↓
○ Recipient Selects from Dropdown
    ├─ Click dropdown to see all available options
    ├─ Select desired option from list
    ├─ Selected option appears in dropdown display
    └─ Selection validated and stored
    ↓
□ Dropdown Completion Validated
    ├─ Required dropdown must have selection
    ├─ Selected value matches configured options
    ├─ Field marked as complete
    └─ Automatic progression to next field
```

---

## Radio Button Group Flows

### Creating Radio Button Group Flow

```
○ User Selects Radio Button Field Type
    ↓
□ Radio Button Group Configuration Opens
    ├─ Group name: "Choose one option"
    ├─ Required/Optional toggle
    ├─ Radio button options list (initially empty)
    └─ "Add Radio Option" button
    ↓
○ User Creates Radio Button Options
    ├─ Add first radio option with label
    ├─ Add second radio option (minimum 2 required)
    ├─ Continue adding options as needed
    └─ Set default selection (optional)
    ↓
□ User Configures Radio Group Properties
    ├─ Arrange radio buttons vertically or horizontally
    ├─ Edit option labels inline
    ├─ Remove options with confirmation
    └─ Confirm single-selection behavior
    ↓
○ Radio Button Group Ready
    ├─ Multiple exclusive options configured
    ├─ Clear labeling for each option
    ├─ Default selection set (if desired)
    └─ Ready to place on document
```

### Radio Button Completion During Signing

```
○ Recipient Encounters Radio Button Group During Signing
    ↓
□ Radio Button Interface Appears
    ├─ Group label shows purpose of selection
    ├─ All radio options visible with labels
    ├─ Default option selected (if configured)
    └─ Clear indication that only one can be selected
    ↓
○ Recipient Selects Radio Button
    ├─ Click desired radio button option
    ├─ Previously selected option automatically deselected
    ├─ New selection highlighted and confirmed
    └─ Single selection enforced automatically
    ↓
□ Radio Selection Validated
    ├─ Required radio group must have selection
    ├─ Only one option can be selected
    ├─ Field marked as complete
    └─ Automatic progression to next field
```

---

## Number Field Flows

### Creating Number Field Flow

```
○ User Selects Number Field Type
    ↓
□ Number Field Configuration Opens
    ├─ Field name: "Enter amount"
    ├─ Required/Optional toggle
    ├─ Number format options (whole numbers, decimals)
    └─ Validation range settings (optional)
    ↓
○ User Configures Number Validation
    ├─ Set minimum value (optional)
    ├─ Set maximum value (optional)
    ├─ Allow decimal places (yes/no)
    └─ Number format display (currency, percentage, plain)
    ↓
□ Number Field Validation Set
    ├─ Validation rules configured
    ├─ Clear field labeling
    ├─ Helpful placeholder text
    └─ Ready to place on document
    ↓
○ Number Field Ready for Placement
    ├─ Validation rules active
    ├─ Clear user guidance
    ├─ Appropriate field sizing
    └─ Ready for document placement
```

### Number Field Completion During Signing

```
○ Recipient Encounters Number Field During Signing
    ↓
□ Number Input Interface Appears
    ├─ Field label explains expected number
    ├─ Number input field with format guidance
    ├─ Placeholder showing expected format
    └─ Clear indication if field is required
    ↓
○ Recipient Enters Number Value
    ├─ Type numeric value in field
    ├─ Real-time validation during input
    ├─ Format assistance (decimal places, etc.)
    └─ Validation feedback for range limits
    ↓
□ Number Input Validated
    ├─ Value meets format requirements (number only)
    ├─ Value within specified range (if set)
    ├─ Required field has value entered
    └─ Field marked as complete
    ↓
○ Number Field Complete
    ├─ Valid number stored
    ├─ Field displays formatted value
    ├─ Automatic progression to next field
    └─ Number available for document completion
```

---

## Checkbox Field Flows

### Creating Checkbox Field Flow

```
○ User Selects Checkbox Field Type
    ↓
□ Checkbox Configuration Opens
    ├─ Field name: "I agree to terms"
    ├─ Required/Optional toggle
    ├─ Default state (checked/unchecked)
    └─ Checkbox label text
    ↓
○ User Configures Checkbox Properties
    ├─ Write clear checkbox label
    ├─ Set default checked state
    ├─ Configure required/optional behavior
    └─ Preview checkbox appearance
    ↓
□ Checkbox Field Ready
    ├─ Clear label explaining what checkbox means
    ├─ Appropriate default state set
    ├─ Required/optional status clear
    └─ Ready to place on document
    ↓
○ Checkbox Placed Successfully
    ├─ Checkbox visible on document
    ├─ Clear labeling for signer understanding
    ├─ Proper sizing for mobile and desktop
    └─ Ready for completion during signing
```

### Checkbox Completion During Signing

```
○ Recipient Encounters Checkbox During Signing
    ↓
□ Checkbox Interface Appears
    ├─ Checkbox with clear label text
    ├─ Current state (checked/unchecked) visible
    ├─ Click target appropriate for mobile and desktop
    └─ Clear indication if checkbox is required
    ↓
○ Recipient Interacts with Checkbox
    ├─ Click checkbox to toggle state
    ├─ Visual feedback for state change
    ├─ Clear indication of current selection
    └─ State change registered immediately
    ↓
□ Checkbox State Validated
    ├─ Required checkbox must be checked
    ├─ Optional checkbox can be checked or unchecked
    ├─ State clearly visible to recipient
    └─ Field marked as complete
    ↓
○ Checkbox Completion Confirmed
    ├─ Final state recorded
    ├─ Visual confirmation of selection
    ├─ Automatic progression to next field
    └─ Checkbox value saved for document
```

---

## Date Field Flows

### Creating Date Field Flow

```
○ User Selects Date Field Type
    ↓
□ Date Field Configuration Opens
    ├─ Field name: "Date signed" or custom label
    ├─ Required/Optional toggle
    ├─ Date format selection (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
    └─ Auto-population setting (current date when signing)
    ↓
○ User Configures Date Field Properties
    ├─ Set field label and description
    ├─ Choose date format appropriate for region/business
    ├─ Enable/disable automatic date population
    └─ Mark field as required or optional
    ↓
□ Date Field Configuration Complete
    ├─ Field properties saved with date format
    ├─ Auto-population behavior configured
    ├─ Required status clearly indicated
    └─ Ready to place on document
    ↓
○ Date Field Ready for Placement
    ├─ Field configuration saved
    ├─ Date format and behavior defined
    ├─ Field ready to place on document
    └─ Automatic date population will occur during signing
```

### Date Field Completion During Signing

```
○ Recipient Encounters Date Field During Signing
    ↓
□ Date Field Interface Appears
    ├─ Field label shows purpose of date field
    ├─ Date automatically populated with current date/time
    ├─ Date format matches configured format (MM/DD/YYYY, etc.)
    └─ Option to manually edit auto-populated date
    ↓
○ Recipient Reviews/Modifies Date
    ├─ Auto-populated date appears in field
    ├─ Date uses recipient's local timezone
    ├─ Recipient can accept auto-populated date
    └─ Or manually edit date if needed
    ↓
□ Date Field Validation
    ├─ Date format validation ensures correct format
    ├─ Date range validation prevents invalid dates
    ├─ Required date fields must have valid date
    └─ Manual edits validated against date format rules
    ↓
○ Date Field Completion
    ├─ Valid date entered in correct format
    ├─ Date value saved with timezone information
    ├─ Field marked as complete
    └─ Automatic progression to next field
```

---

## Advanced Field Editing and Management

### Editing Placed Advanced Fields Flow

```
○ User Needs to Modify Placed Advanced Field
    ↓
□ User Selects Field for Editing
    ├─ Click on placed advanced field
    ├─ Field editing interface opens
    ├─ Current field configuration displayed
    └─ All field properties available for modification
    ↓
○ User Modifies Field Properties
    ├─ Change field options (dropdown choices, radio options)
    ├─ Update validation rules (number ranges)
    ├─ Modify required/optional status
    └─ Update field labeling and descriptions
    ↓
□ Field Changes Applied
    ├─ Updated configuration saved
    ├─ Field appearance updated on document
    ├─ Recipient assignment maintained
    └─ Field ready with new configuration
    ↓
○ Advanced Field Updated Successfully
    ├─ Changes visible on document
    ├─ New configuration active for signing
    ├─ Field continues working in workflow
    └─ Updated field ready for document sending
```

### Advanced Field Mobile Compatibility Flow

```
○ Advanced Field Accessed on Mobile Device During Signing
    ↓
□ Mobile-Optimized Interface Loads
    ├─ Field interface adapts to mobile screen
    ├─ Touch-friendly controls for all field types
    ├─ Appropriate sizing for finger interactions
    └─ Clear labeling readable on small screens
    ↓
○ Mobile Field Interaction
    ├─ Dropdown: Touch-friendly dropdown menu
    ├─ Radio buttons: Large touch targets
    ├─ Number field: Mobile numeric keyboard
    ├─ Checkbox: Large checkbox with clear label
    ├─ Date field: Mobile date picker with auto-population
    └─ All interactions work smoothly on mobile
    ↓
□ Mobile Field Completion
    ├─ Field values entered successfully on mobile
    ├─ Validation works correctly on mobile interface
    ├─ Visual confirmation appropriate for mobile
    └─ Seamless progression to next field
    ↓
○ Mobile Advanced Field Experience Complete
    ├─ All advanced fields fully functional on mobile
    ├─ Professional user experience maintained
    ├─ Field completion identical to desktop
    └─ Mobile signing process continues smoothly
```

---

## Integration with Existing Field System

### Advanced Fields in Complete Document Flow

```
○ Document Contains Mix of Basic and Advanced Fields
    ↓
□ User Places All Field Types
    ├─ Signature fields for authentication
    ├─ Date fields (auto-populated)
    ├─ Text fields for custom input
    └─ Advanced fields (dropdown, radio, number, checkbox)
    ↓
○ All Fields Assigned to Recipients
    ├─ Each field assigned to specific recipient
    ├─ Color coding consistent across all field types
    ├─ Field types clearly distinguishable
    └─ Recipients understand their required actions
    ↓
□ Document Sent for Signing
    ├─ Recipients receive signing invitations
    ├─ All field types appear in signing interface
    ├─ Advanced fields work alongside basic fields
    └─ Field completion tracked for all types
    ↓
○ Complete Document Signing Experience
    ├─ Recipients complete all field types seamlessly
    ├─ Advanced fields provide enhanced form capabilities
    ├─ Document completion includes all field values
    └─ Professional signing experience with rich field options
```

This comprehensive advanced field system extends the existing signature workflow with commonly needed form field types, maintaining the same ease of use and professional experience while providing more sophisticated document completion options.

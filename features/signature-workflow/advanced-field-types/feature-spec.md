# Feature #18: Advanced Field Types

## Feature Requirements (MVP Core Features)

### Advanced Field Types ⚡ **Important**
- [ ] **Dropdown Fields** with predefined options
- [ ] **Radio Button Groups** for single selection
- [ ] **Number Fields** with numeric validation
- [ ] **Checkbox Fields** for yes/no selection
- [ ] **Date Fields** with automatic date population

## Technology Stack Integration
- **React**: Advanced field input components 
- **Konva.js**: Canvas positioning for field placement
- **PDF-lib**: PDF field embedding
- **Zod**: Basic field validation 
- **Convex**: Field data storage

## Business Requirements
- Extend basic signature fields with common form field types
- Simple dropdown and radio button options
- Number field validation
- Basic checkbox functionality
- Consistent with existing field placement workflow

---

## Freemium Model Integration

### Simple Plan Structure
- **Free Plan**: All advanced field types available, 10 documents per month limit
- **Pro Plan**: All advanced field types available, unlimited documents + API access + multiple workspace users

### All Advanced Field Features Available on Both Plans
- Dropdown fields with unlimited options
- Radio button groups with multiple choices
- Number fields with validation
- Checkbox fields
- All field types work in mobile and desktop signing
- Complete field management and editing

### Pro Plan Exclusive Features
- **API Access**: Programmatic field operations
- **Multiple Workspace Users**: Teams and collaboration
- **Unlimited Documents**: No monthly document limits

---

## Edge Cases (MVP Focus)

### Basic Field States
- `placing` - Adding advanced field to document
- `configuring` - Setting up field options (dropdown choices, etc.)
- `completing` - User filling out field during signing

### Core Edge Cases

#### Dropdown Fields
- [ ] **Dropdown creation**: Create dropdown with list of options
- [ ] **Option management**: Add/remove dropdown options during field setup
- [ ] **Dropdown completion**: User selects from dropdown during signing
- [ ] **Required field handling**: Mark dropdown as required or optional
- [ ] **Default selection**: Set default dropdown option

#### Radio Button Groups
- [ ] **Radio group creation**: Create radio button group with options
- [ ] **Option management**: Add/remove radio button options
- [ ] **Single selection**: Ensure only one radio button selected
- [ ] **Radio completion**: User selects radio button during signing
- [ ] **Required field handling**: Mark radio group as required

#### Number Fields
- [ ] **Number input**: Accept numeric input only
- [ ] **Number validation**: Validate numeric format
- [ ] **Range validation**: Optional min/max number ranges
- [ ] **Required number**: Mark number field as required
- [ ] **Decimal handling**: Support whole numbers and decimals

#### Checkbox Fields  
- [ ] **Single checkbox**: Yes/no checkbox fields
- [ ] **Checkbox completion**: User checks/unchecks during signing
- [ ] **Required checkbox**: Mark checkbox as required
- [ ] **Default state**: Set checkbox as checked or unchecked by default

#### Date Fields
- [ ] **Automatic date population**: Date fields auto-filled with current date/time when signing
- [ ] **Date format options**: Support MM/DD/YYYY, DD/MM/YYYY, and YYYY-MM-DD formats
- [ ] **Manual date entry**: Allow recipients to manually edit auto-populated date
- [ ] **Date validation**: Ensure valid date formats and reasonable date ranges
- [ ] **Required date fields**: Mark date fields as required or optional
- [ ] **Timezone handling**: Use recipient's local timezone for date population

#### Field Integration
- [ ] **Field placement**: Place advanced fields using existing Konva.js system
- [ ] **Field assignment**: Assign advanced fields to specific recipients
- [ ] **Field validation**: Validate field completion before document submission
- [ ] **Mobile compatibility**: All advanced fields work on mobile devices

This simplified feature focuses on essential advanced field types for MVP launch, extending the existing signature field system with commonly needed form fields.
# User Profile Flow Documentation

## Overview

This document outlines all user flows for profile management, including profile editing, notification preferences, account settings, and usage statistics viewing.

---

## 🔄 Primary User Flows

### Profile Editing Flow

#### Happy Path Workflow
```
○ User Accesses Profile
    ↓
□ Profile Settings Page
    ├─ Current profile data loaded
    ├─ Avatar, name, email displayed
    └─ Edit mode available
    ↓
□ User Makes Changes
    ├─ Edit name, email, or upload avatar
    ├─ Real-time validation
    └─ Changes highlighted
    ↓
□ Save Changes
    ├─ Better Auth profile update
    ├─ Convex real-time sync
    └─ Success confirmation
    ↓
◉ Profile Updated
    ├─ All sessions updated
    ├─ Notification sent if email changed
    └─ Return to profile view
```

#### Profile Edit Error Flow
```
Profile Edit Errors:
○ User Submits Changes
    ↓
◇ Validation Check
    ├─ Valid Changes → 🟢 Save Successfully
    │
    ├─ Invalid Email Format → 🔴 Email Validation Error
    │                           ↓
    │                       □ Show inline error
    │                           ↓
    │                       ↩ Fix and retry
    │
    ├─ Email Already Exists → 🔴 Email Conflict Error
    │                          ↓
    │                      □ "Email already in use"
    │                          ↓
    │                      ↩ Choose different email
    │
    └─ Network Error → 🔴 Save Failed
                        ↓
                    □ "Changes not saved. Retry?"
                        ↓
                    ↩ Retry save operation
```

### Avatar Upload Flow

#### Avatar Upload Process
```
○ User Clicks Avatar Upload
    ↓
□ File Picker Opens
    ├─ Accepts: JPG, PNG, JPEG, WebP
    ├─ Max size: 5MB
    └─ Image validation
    ↓
◇ File Validation
    ├─ Valid Image → 🟢 Upload Process
    │                 ↓
    │             □ Image Resize/Optimize
    │                 ↓
    │             □ Upload to Storage
    │                 ↓
    │             ◉ Avatar Updated
    │
    ├─ Invalid Format → 🔴 Format Error
    │                    ↓
    │                □ "Please use JPG, PNG, or WebP"
    │                    ↓
    │                ↩ Try again
    │
    ├─ File Too Large → 🔴 Size Error
    │                    ↓
    │                □ "Image must be under 5MB"
    │                    ↓
    │                ↩ Choose smaller file
    │
    └─ Upload Failed → 🔴 Upload Error
                        ↓
                    □ "Upload failed. Try again?"
                        ↓
                    ↩ Retry upload
```

### Email Change Flow

#### Email Change Process
```
○ User Changes Email
    ↓
□ New Email Entered
    ├─ Format validation
    ├─ Availability check
    └─ Different from current
    ↓
□ Verification Required
    ├─ Send verification to NEW email
    ├─ Send notification to OLD email
    └─ Profile shows "Pending verification"
    ↓
□ User Clicks Verification Link
    ├─ Email verified
    ├─ Better Auth profile updated
    └─ All sessions refreshed
    ↓
◉ Email Change Complete
    ├─ Profile updated everywhere
    ├─ Confirmation notification sent
    └─ Old email notified of change
```

---

## ⚙️ Settings & Preferences Flows

### Notification Preferences Flow

#### Simplified Notification Settings
```
○ User Accesses Notification Settings
    ↓
□ Notification Preferences Panel
    ├─ Email notifications (global on/off)
    └─ Email frequency (immediate vs daily digest)
    ↓
□ User Updates Preferences
    ├─ Toggle email notifications
    ├─ Change email frequency
    └─ Auto-save preferences
    ↓
◉ Preferences Saved
    ├─ Real-time sync via Convex
    ├─ Test notification option
    └─ Confirmation message
```

### Account Settings Flow

#### Security Settings
```
○ User Accesses Account Settings
    ↓
□ Security Settings Panel
    ├─ Password change option
    ├─ Two-factor authentication
    ├─ Active sessions view
    └─ Account deletion option
    ↓
◇ User Action
    ├─ Change Password → Password Reset Flow
    ├─ Enable 2FA → 2FA Setup Flow
    ├─ View Sessions → Active Sessions List
    └─ Delete Account → Account Deletion Flow
```

---

## 📊 Usage Statistics Flows

### Statistics Viewing Flow

#### Per-Workspace Statistics
```
○ User Views Usage Statistics
    ↓
□ Statistics Dashboard
    ├─ Current workspace context
    ├─ Documents sent this month
    ├─ Documents signed this month
    ├─ Total documents (all time)
    └─ API usage (if applicable)
    ↓
◇ Workspace Switch
    ├─ Same Workspace → Continue viewing
    └─ Different Workspace → Update statistics
                              ↓
                          □ Load new workspace stats
                              ↓
                          ◉ New workspace statistics shown
```

#### API Key Management Flow
```
○ User Manages API Keys
    ↓
□ API Keys Section
    ├─ Current workspace API keys
    ├─ Usage statistics per key
    ├─ Creation/deletion options
    └─ Permission settings
    ↓
◇ User Action
    ├─ Create New Key → API Key Creation Flow
    ├─ Delete Key → Confirmation → Delete
    ├─ View Usage → Detailed usage stats
    └─ Modify Permissions → Permission Editor
```

---

## 🚫 Account Deletion Flow

### Account Deletion Process
```
○ User Requests Account Deletion
    ↓
□ Pre-deletion Checks
    ├─ Active documents warning
    ├─ Workspace ownership check
    ├─ Subscription status check
    └─ Data export option
    ↓
◇ Blocking Issues?
    ├─ No Issues → 🟢 Proceed to deletion
    │               ↓
    │           □ 90-day grace period info
    │               ↓
    │           □ Final confirmation required
    │               ↓
    │           ◉ Account marked for deletion
    │
    └─ Issues Found → 🔴 Cannot Delete
                        ├─ Transfer ownership first
                        ├─ Cancel subscription first
                        ├─ Complete pending documents
                        └─ Resolve issues then retry
```

---

## 📱 Mobile-Specific Flows

### Mobile Profile Management
```
Mobile Considerations:
○ Touch-Optimized Interface
    ├─ Larger tap targets (44px minimum)
    ├─ Swipe gestures for navigation
    ├─ Bottom sheet for settings
    └─ Camera integration for avatar
    ↓
□ Mobile Avatar Upload
    ├─ Camera capture option
    ├─ Photo library selection
    ├─ Basic cropping interface
    └─ Compression before upload
```

---

## 🎯 Success Criteria

### Flow Completion Targets
- **Profile Update**: >95% successful profile updates
- **Avatar Upload**: >90% successful avatar uploads  
- **Email Verification**: >85% email change completion
- **Settings Sync**: <2 seconds for preference updates

### Error Recovery Rates
- **Network Errors**: >80% retry success rate
- **Validation Errors**: >95% user correction rate
- **Upload Errors**: >75% successful retry rate

---

This comprehensive flow documentation ensures consistent user experiences across all profile management features while maintaining security and data integrity.
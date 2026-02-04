/**
 * Test data generators for consistent test data creation
 */

export const testData = {
  /**
   * Generate a unique email for testing
   */
  email: (prefix = "test"): string => {
    const timestamp = Date.now();
    return `${prefix}+${timestamp}@seal-test.com`;
  },

  /**
   * Generate a unique organization name
   */
  organizationName: (prefix = "Test Org"): string => {
    const timestamp = Date.now();
    return `${prefix} ${timestamp}`;
  },

  /**
   * Generate a unique document name
   */
  documentName: (prefix = "Test Document"): string => {
    const timestamp = Date.now();
    return `${prefix} ${timestamp}`;
  },

  /**
   * Generate a unique template name
   */
  templateName: (prefix = "Test Template"): string => {
    const timestamp = Date.now();
    return `${prefix} ${timestamp}`;
  },

  /**
   * Generate random user data
   */
  user: () => ({
    firstName: "Test",
    lastName: "User",
    email: testData.email("user"),
    password: "TestPassword123!",
  }),

  /**
   * Generate random recipient data
   */
  recipient: () => ({
    name: `Test Recipient ${Date.now()}`,
    email: testData.email("recipient"),
  }),

  /**
   * PDF file path for testing
   */
  samplePdfPath: "./e2e/fixtures/sample-document.pdf",
};

export const testConstants = {
  /**
   * Default organization slug for tests
   */
  DEFAULT_ORG_SLUG: "seal-test-1761570045",

  /**
   * Timeout values
   */
  TIMEOUT: {
    SHORT: 5000,
    MEDIUM: 10000,
    LONG: 30000,
  },

  /**
   * Test user credentials (if using pre-seeded data)
   */
  TEST_USER: {
    EMAIL: process.env.TEST_USER_EMAIL || "test@seal-test.com",
    PASSWORD: process.env.TEST_USER_PASSWORD || "TestPassword123!",
  },
};

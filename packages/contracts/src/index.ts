export { errorCodes, apiErrorSchema } from "./api-errors.js";
export type { ErrorCode, ApiError } from "./api-errors.js";

export {
  CARS_PAGE_SIZE,
  carColorSchema,
  carCardSchema,
  carDetailsSchema,
  carImageSchema,
  carSorts,
  carsQuerySchema,
  carsResponseSchema,
  catalogFiltersSchema,
  driveTypes,
  filterOptionSchema,
} from "./catalog.js";
export type {
  CarCard,
  CarColor,
  CarDetails,
  CarImage,
  CarSort,
  CarsQuery,
  CarsResponse,
  CatalogFilters,
  DriveType,
  FilterOption,
} from "./catalog.js";

export { SALON_TIME_ZONE } from "./common.js";

export {
  createTestDriveSchema,
  myTestDrivesSchema,
  slotSchema,
  slotsQuerySchema,
  slotsResponseSchema,
  testDriveCarSchema,
  testDriveSchema,
  testDriveStatuses,
} from "./test-drives.js";
export type {
  CreateTestDrive,
  MyTestDrives,
  Slot,
  SlotsQuery,
  SlotsResponse,
  TestDrive,
  TestDriveCar,
  TestDriveStatus,
} from "./test-drives.js";

export {
  closeTestDriveSchema,
  managerTestDriveSchema,
  managerTestDrivesQuerySchema,
  managerTestDrivesSchema,
  testDriveClientSchema,
} from "./manager.js";
export type {
  CloseTestDrive,
  ManagerTestDrive,
  ManagerTestDrives,
  ManagerTestDrivesQuery,
  TestDriveClient,
} from "./manager.js";

export {
  USERS_PAGE_SIZE,
  createManagerSchema,
  userRoles,
  userSchema,
  usersQuerySchema,
  usersResponseSchema,
} from "./admin.js";
export type { CreateManager, User, UserRole, UsersQuery, UsersResponse } from "./admin.js";

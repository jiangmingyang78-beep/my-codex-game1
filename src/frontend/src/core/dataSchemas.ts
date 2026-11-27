import { adventureSchemas } from "./schemas/adventure";
import { configurationSchemas } from "./schemas/configuration";
import { survivalSchemas } from "./schemas/survival";
export const schemas = {
  ...adventureSchemas,
  ...survivalSchemas,
  ...configurationSchemas,
};

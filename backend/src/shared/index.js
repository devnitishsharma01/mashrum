"use strict";

module.exports = {
  ...require("./constants"),
  ...require("./roles"),
  ...require("./order-lifecycle"),
  ...require("./schemas/auth"),
  ...require("./schemas/business"),
  ...require("./schemas/catalog"),
  ...require("./schemas/customer"),
  ...require("./schemas/order"),
  ...require("./schemas/whatsapp"),
  ...require("./schemas/users"),
  ...require("./schemas/reports"),
  ...require("./working-hours"),
};

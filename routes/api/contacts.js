const express = require("express");
const router = express.Router();
const contactController = require("../../controllers/contact-controller");
const isValidId = require("../../middlewares/isValidId");
const validateBody = require("../../decorators/validateBody");
const authenticate = require("../../middlewares/authenticate");
const {
  addContactValid,
  contactChangeSchema,
} = require("../../utils/contactValidation");

const contactAddValid = validateBody(addContactValid);
const contactFavoriteValid = validateBody(contactChangeSchema);

router.use(authenticate);

router.get("/", contactController.GetAll);

router.get("/:contactId", isValidId, contactController.GetById);

router.post("/", contactController.AddContact);

router.put(
  "/:contactId",
  isValidId,
  contactAddValid,
  contactController.UpdateById
);

router.patch(
  "/:contactId/favorite",
  isValidId,
  contactFavoriteValid,
  contactController.UpdateFavoriteById
);

module.exports = router;

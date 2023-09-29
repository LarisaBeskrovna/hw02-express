const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const jimp = require("jimp");
const path = require("path");
const fs = require("fs/promises");
const User = require("../models/User");
const HttpError = require("../helpers/httpError");
const sendEmail = require("../helpers/sendEmail");
const ctrlWrapper = require("../decorators/ctrlWrapper");
const gravatar = require("gravatar");
const nanoid = require("nanoid");

const { JWT_SECRET, BASE_URL } = process.env;

const signup = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, "Email already exist");
  }

  const verificationCode = nanoid();
  const hashPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email, {
    s: "200",
    r: "pg",
    d: "identicon",
  });
  const newUser = await User.create({
    ...req.body,
    password: hashPassword,
    avatarURL,
    verificationCode,
  });

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="${BASE_URL}/api/auth/verify/${verificationCode}">Click to verify email</a>`,
  };
  await sendEmail(verifyEmail);

  res.status(201).json({
    user: {
      email: newUser.email,
      subscription: "starter",
      avatarURL: newUser.avatarURL,
    },
  });
};
const verify = async (req, res) => {
  const { verificationCode } = req.params;
  const user = await User.findOne({ verificationCode });
  if (!user) {
    throw HttpError(404);
  }

  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationCode: "",
  });

  res.json({
    message: "Email verify success",
  });
};

const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(404, "email not found");
  }
  if (user.verify) {
    throw HttpError(400, "Email already verify");
  }

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="${BASE_URL}/api/auth/verify/${user.verificationCode}">Click to verify email</a>`,
  };
  await sendEmail(verifyEmail);

  res.json({
    message: "Verify email resend success",
  });
};

const signin = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, "Email or password invalid");
  }

  if (!user.verify) {
    throw HttpError(401, "Email not verify");
  }

  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Email or password invalid");
  }
  const { _id: id } = user;
  const payload = {
    id,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
  await User.findByIdAndUpdate(id, { accessToken });
  res.json({
    accessToken,
    user: {
      email: user.email,
      subscription: "starter",
    },
  });
};

const getCurrent = (req, res) => {
  const { subscription, email } = req.user;

  res.json({
    subscription,
    email,
  });
};

const signout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { accessToken: "" });

  res.json({
    message: "Signout success",
  });
};

const refresh = async (req, res) => {
  const { subscription } = req.body;
  const { _id: userId } = req.user;
  const validSubscriptions = ["starter", "pro", "business"];
  if (!validSubscriptions.includes(subscription)) {
    throw HttpError(400, "Invalid subscription value.");
  }
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { subscription },
    { new: true }
  );

  if (!updatedUser) {
    throw HttpError(404, "User not found.");
  }
  res.json({
    user: {
      email: updatedUser.email,
      subscription: updatedUser.subscription,
    },
  });
};

const avatars = async (req, res) => {
  const { _id: userId } = req.user;
  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }
  try {
    const uniqueName = `${userId}_${Date.now()}${path.extname(
      req.file.originalname
    )}`;
    const publicAvatars = path.join(process.cwd(), "public/avatars");
    const avatarPath = path.join(publicAvatars, uniqueName);
    const imagePath = req.file.path;
    const image = await jimp.read(imagePath);
    await image.resize(200, 200);
    await image.writeAsync(imagePath);
    await fs.rename(imagePath, avatarPath);
    const avatarURL = `/avatars/${uniqueName}`;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatarURL },
      { new: true }
    );
    res.status(200).json({ updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  signup: ctrlWrapper(signup),
  signin: ctrlWrapper(signin),
  verify: ctrlWrapper(verify),
  resendVerifyEmail: ctrlWrapper(resendVerifyEmail),
  getCurrent: ctrlWrapper(getCurrent),
  signout: ctrlWrapper(signout),
  refresh: ctrlWrapper(refresh),
  avatars: ctrlWrapper(avatars),
};

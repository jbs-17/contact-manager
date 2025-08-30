import config from "./config.mjs";
import connectToDB from "./utils/db.mjs";
import express from "express";
import session from "express-session";
import expressLayouts from "express-ejs-layouts";
import flash from "connect-flash";
import cookieParser from "cookie-parser";
import rateLimit from 'express-rate-limit';
import page from "./routes/page.mjs";
import {signedIn,verifySignIn } from "./routes/signed-in.mjs";
import path from 'node:path';
import methodOverride from 'method-override';
import jsonwebtoken from "jsonwebtoken";
import User from "./models/user.mjs";

const {layout} = config;

const app = express();

app.use((req,res,next)=>{
  console.log(req.originalUrl);
  next();
})

// Set view engine
app.set("view engine", "ejs");
app.set("views", "views/");

// Middleware
app.use(expressLayouts);
app.use(cookieParser());
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "hanya yang membaca ini yang tau",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);
app.use(flash());
// rateLimit halaman
app.use(rateLimit({
  windowMs: 112 * 1000,
  max: 1000,
  message: 'Too many requests from this IP',
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => {
    res.render("429", { title: "Too-Many-Request", ...layout });
  }
}))
app.use(express.static("./public"));


// Routes
app.get('/loading', (req, res)=>{
  res.status(200).render("loading", {
    ...layout,
    title: "Loading",
    referer: req.headers.referer || '/home'
  });
  
});



const isSignedIn = async (req, res, next) => {
  const { sign_in_token } = req.cookies;
  try {
    const verify = jsonwebtoken.verify(sign_in_token, process.env.JWT_SECRET);
    const { id } = verify;
    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found!');
    }
    req.user = user
    req.userData = user.toJSON();
    req.theme = user.settings.theme;
    next();
    // console.log(req.user.settings);
  } catch{
    next();
  }
};


app.use(isSignedIn);
app.use('/', page);
app.use('/', signedIn);

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    ...layout,
    theme: req.theme,
    title: path.basename(req.path),
    path: req.path,
    referer: req.headers.referer || '/home'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).render("error.ejs", {
    ...layout,
    theme: req.theme,
    title: "Server Error",
    error: err,
    stack: err.stack?.split('\n')
  });
});

const PORT = process.env.PORT || 3000;
connectToDB()
  .then(msg => {
    console.log(msg);
    app.listen(PORT, () => {
      console.log(`App running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.log(error);
    process.exit(1);
  });

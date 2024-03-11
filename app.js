import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { validationResult, body } from "express-validator";
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import GoogleStrategy from "passport-google-oauth20";
import findOrCreate from "mongoose-findorcreate";
import _ from "lodash";

const app = express();
const port = 3000;

// Default declarations
const postCategories = [
  "unknown",
  "lie",
  "romantic-desire",
  "finance",
  "sexual-behavior",
  "extra-relational-thoughts",
  "family-detail",
  "ambition",
  "social-discontent",
  "violate-trust",
  "pyhsical-discontent",
  "mental-health",
  "preference",
  "romantic-discontent",
  "suprise",
  "hobby",
  "theft",
  "personal-story",
  "belief-ideologi",
  "work-cheating",
  "emotional-infidentity",
  "no-sex",
  "hidden-relationship",
  "drag-use",
  "poor-work-preformance",
  "habbit",
  "counternormative",
  "self-harm",
  "sexual-orientation",
  "pregnant",
  "marriage-proposal",
  "abortion",
  "other",
];

// middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "secret from synoma",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// connect db with atlas
await mongoose.connect(
  "mongodb+srv://heykalsayid:secret006@cluster0.d8hlsgp.mongodb.net/synomaDB"
);

// users collection schema and model
const userSchema = new mongoose.Schema({
  nickname: String,
  posts: [
    {
      id: String,
      header: String,
      body: String,
      date: Date,
      category: String,
      sumLiked: Number,
    },
  ],
  liked: [{ id: String }],
  googleId: Number,
  googleMetadata: {},
  provider: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
passport.use(User.createStrategy());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/spread",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate(
        {
          googleId: profile.id,
          provider: profile.provider,
          googleMetadata: profile._json,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

// serialization adn deserialization
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

const docs = await User.find({});
const posts = [];
docs.forEach((doc) => {
  posts.push(...doc.posts);
});

// start routing
app.get("/", async (req, res) => {
  // create avariable stores all posts
  console.log("auth?: ", req.isAuthenticated());

  res.render("home.ejs", {
    isAuth: req.isAuthenticated(),
    currentUser: req.isAuthenticated() && (await User.findById(req.user.id)),
    users: await User.find(),
    categories: postCategories.map((category) => {
      return _.startCase(category);
    }),
    posts: posts.sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    }),

    // Define categories value and remove other category and remove duplicate values
    categoriesSelected: _.remove(
      _.uniq(
        posts.map((post) => {
          return post.category;
        })
      ),
      (n) => {
        return n !== "Other";
      }
    ),
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/spread",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);

app.get("/signIn", async (req, res) => {
  console.log(res.user);
  res.render("signIn.ejs", { user: res.user });
});

app.get("/signUp", async (req, res) => {
  res.render("signUp.ejs", { user: res.user });
});

app.get("/signOut", (req, res) => {
  req.logOut(function (err) {
    err ? console.log(err) : res.redirect("/");
  });
});

// filter home categories
app.get("/category/:categoryId", async (req, res) => {
  const docs = await User.find({});
  const posts = [];
  docs.forEach((doc) => {
    posts.push(...doc.posts);
  });

  console.log(posts);
  const categoryId = req.params.categoryId;

  res.render("home.ejs", {
    posts:
      categoryId === "all"
        ? posts.sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
          })
        : posts.filter((post) => post.category === categoryId),
    categoryId: categoryId,
    // Define categories value and remove other category and remove duplicate values
    categoriesSelected: _.remove(
      _.uniq(
        posts.map((post) => {
          return post.category;
        })
      ),
      (n) => {
        return n !== "Other";
      }
    ),
    isAuth: req.isAuthenticated(),
    currentUser: req.isAuthenticated() && (await User.findById(req.user.id)),
    users: await User.find(),
    categories: postCategories.map((category) => {
      return _.startCase(category);
    }),
  });
});

app.get("/@:nickname", async (req, res) => {
  console.log(req.params);
  res.render("profile.ejs", {
    isAuth: req.isAuthenticated(),
    currentUser: req.isAuthenticated()
      ? await User.findById(req.user.id)
      : res.redirect("/"),
  });
});

app.post("/signIn", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.error(err);
    } else {
      const auth = passport.authenticate("local", {
        failureRedirect: "/signIn",
        failureMessage: true,
      });

      auth(req, res, function () {
        res.redirect("/");
      });
    }
  });
});

app.post(
  "/signUp",
  body("repeatPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password!");
    } else {
      throw new Error(null);
    }
  }),
  (req, res) => {
    const result = validationResult(req);
    const errorMsg = result.errors[0].msg;

    if (errorMsg == "null") {
      User.register(
        {
          nickname: req.body.nickname,
          username: req.body.username,
        },
        req.body.password,
        function (err, user) {
          if (err) {
            console.log(err);
            res.redirect("/signUp");
          } else {
            console.log(user);
            const auth = passport.authenticate("local");
            auth(req, res, function () {
              res.redirect("/");
            });
          }
        }
      );
    } else {
      res.render("signUp.ejs", { errorMsg: errorMsg });
    }
  }
);

app.post("/submit", async (req, res) => {
  console.log(req.body);

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $push: { posts: { ...req.body, date: new Date() } },
    });
  } catch (error) {
    console.log(error);
  } finally {
    res.redirect("/");
  }
});

app.post("/likes", async function (req, res) {
  if (req.isAuthenticated()) {
    const postId = req.body.postId;
  } else {
    res.redirect("/signIn");
  }
});

app.listen(port, () => {
  console.log(`listening on ${port}`);
});

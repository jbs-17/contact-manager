import config from "../config.mjs";
import express from "express";
import User from "../models/user.mjs";
import jsonwebtoken from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import bcrypt from "bcryptjs";
import { oneTimePageFactory } from '../utils/onetimepagefactory.mjs';


const contactsPerPage = 10;
const { layout } = config;

const signedIn = express.Router();


const verifySignIn = async (req, res, next) => {
  if (req.user !== null && req.user !== undefined) {
    return next();
  }
  const { sign_in_token } = req.cookies;
  try {
    const verify = jsonwebtoken.verify(sign_in_token, process.env.JWT_SECRET);
    const { id } = verify;
    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found!');
    }
    req.user = user;
    req.userData = user.toJSON();
    req.theme = user.settings.theme;
    next();
  } catch {
    req.flash('signedIn', 'Sign In to your account!');
    res.redirect('/sign-in')
  }
};

/* signedIn Router */
signedIn.get("/sign-out", verifySignIn, async (req, res) => {
  res.cookie('sign_in_token', '', { expires: 0 });
  res.render("sign-out", {
    ...layout,
    theme: req.theme,
    title: "Sign Out",
  });
});



signedIn.get("/dashboard", verifySignIn, async (req, res) => {
  let totalContacts = 0;
  let favoriteTotal = 0;
  let recentContact = null;
  let mostFields = [0, null];
  const contacts = req.userData?.contacts
  if (contacts?.length > 0) {
    contacts.forEach((contact) => {
      totalContacts++;
      if (contact.favorite === true) favoriteTotal++;

      if (recentContact == null) {
        recentContact = contact;
      } else {
        const current = new Date(recentContact.updatedAt), next = new Date(contact.updatedAt);
        recentContact = current > next ? recentContact : contact;
      }

      const fieldsTotal = Object.keys(contact).length;
      const referenceto = mostFields;
      if (fieldsTotal > mostFields[0]) {
        contact.fieldsTotal = fieldsTotal;
        referenceto[0] = fieldsTotal;
        referenceto[1] = contact;
      };
    });;
  };
  res.render("dashboard", {
    ...layout,
    title: "Dashboard",
    signedIn: req.flash('sign-in'),
    theme: req.theme,
    totalContacts,
    favoriteTotal,
    recentContact,
    mostFields
  });
});
signedIn.get('/settings', verifySignIn, async (req, res) => {
  let { theme } = req.query;
  let info = req.flash('info') || '';
  if (theme) {
    await req.user.toggleTheme();
    info = `Changed to ${theme === 'default' ? 'Default' : 'Dark'} Theme`;
    req.flash('info', info);
    return res.redirect('/settings');
  }
  res.render("settings", {
    ...layout,
    title: "Setting",
    info,
    ...req.userData,
    theme: req.theme,
  });
});






//
signedIn.get('/contact/add', verifySignIn, async (req, res) => {
  let formData = req.flash('formData')[0] || '';
  const info = req.flash('info');
  const error = req.flash('error');
  if (formData) {
    try {
      formData = JSON.parse(formData);
    } catch (error) {
      formData = '';
    }
  };
  res.render("add", {
    ...layout,
    title: "Contacts",
    signedIn: req.flash('sign-in'),
    ...req.userData,
    info,
    error,
    formData,
    theme: req.theme,
  });
});


const validateFormData = [
  verifySignIn,
  body('name', 'name invalid!').trim().notEmpty(),
  body('priority', 'invalid priority number! allowed 0-100').custom(value => {
    value = parseInt(value);
    return !isNaN(value) && value <= 100 && value >= 0;
  })
]

signedIn.post('/contact/add', validateFormData, async (req, res, formData) => {
  const contact = createContact(req.body);
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      throw new Error('input invalid!')
    };
    let { name } = req.body;
    formData = req.body;
    await req.user.addContact(contact);
    req.flash('info', `Contact named ${name} added!`);
    res.redirect(`/contact/${name}`);
  } catch (error) {
    if (error.message && error.message?.includes('name')) {
      req.flash('error', 'error: ' + error.message);
      req.flash('formData', JSON.stringify(formData));
    } else {
      req.flash('error', 'Error to add contact! please input valid form!');
    }
    res.redirect('/contact/add');
  }
});







//READ lihat detail kontak
signedIn.patch('/contact/:nameId/favorite', async (req, res) => {
  try {
    const { nameId } = req.params;
    if (nameId == null) throw Error('Contact name undefined');
    req.user.toggleFavorite(nameId);
    return res.json({ status: true });
  } catch (error) {
    return res.json({ status: false, error });
  }
})
signedIn.get('/contact/:nameId', verifySignIn, async (req, res, namex) => {
  const info = req.flash('info')[0] || '';
  const { nameId } = req.params;
  namex = nameId;
  try {
    let { _id, favorite, priority, createdAt, updatedAt, name, ...fields } = await req.user.findContactByName(nameId);
    fields = Object.entries(fields);
    const data = {
      _id, favorite, priority, createdAt: new Date(createdAt).toUTCString(), updatedAt: new Date(updatedAt).toUTCString(), name, fields
    };

    res.render("detail", {
      ...layout,
      title: name,
      ...data,
      info,
      theme: req.theme,
    });

  } catch (error) {
    res.render("detail-404", {
      ...layout,
      title: namex,
      namex,
      theme: req.theme,
    });
  }
});

signedIn.delete('/contact/:nameId', verifySignIn, async (req, res, namex) => {
  const { nameId } = req.params;
  try {
    const result = await req.user.deleteContactByName(nameId);
    if (result === true) {
      req.flash('info', `Succes delete contact ${nameId}!`)
      return res.redirect('/contacts');
    }
    throw new Error('Failed to delete contact!');
  } catch (error) {
    req.flash('error', 'Failed to delete contact!')
    res.redirect(req.path);
  }
});




//READ lihat detail kontak
signedIn.get('/contact/:nameId', verifySignIn, async (req, res, namex) => {
  const info = req.flash('info')[0] || '';
  const { favorite: f } = req.query;
  const { nameId } = req.params;
  namex = nameId;
  try {
    if (f) {
      return req.user.toggleFavorite(nameId);
    }
    let { _id, favorite, priority, createdAt, updatedAt, name, ...fields } = await req.user.findContactByName(nameId);
    fields = Object.entries(fields);
    const data = {
      _id, favorite, priority, createdAt: new Date(createdAt).toUTCString(), updatedAt: new Date(updatedAt).toUTCString(), name, fields
    };

    res.render("detail", {
      ...layout,
      title: name,
      ...data,
      info,
      theme: req.theme,
    });

  } catch (error) {
    res.render("detail-404", {
      ...layout,
      title: namex + " Not Found",
      namex,
      theme: req.theme,
    });
  }
});



//UPDATE edit kontak
signedIn.route('/contact/edit/:nameId')
  .get(verifySignIn, async (req, res, namex) => {
    const { nameId } = req.params;
    namex = nameId;
    try {
      let { _id, favorite, priority, createdAt, updatedAt, name, ...fields } = await req.user.findContactByName(nameId);
      fields = Object.entries(fields);
      const data = {
        _id, favorite, priority, createdAt: new Date(createdAt).toUTCString(), updatedAt: new Date(updatedAt).toUTCString(), name, fields
      };
      res.render("edit", {
        ...layout,
        title: `Edit ${name}`,
        ...data,
        info: '',
        theme: req.theme,
      });
    } catch (error) {
      res.redirect('/contacts');
    }
  })
  .patch([verifySignIn,
    body('name').trim(),
  ], async (req, res) => {
    // req.body.name = req.body.name.trim()
    const formData = createContact(req.body);
    const { _id, name } = req.body;
    try {
      const result = await req.user.patchContact(_id, formData);
      req.flash('info', 'Contact edited')
      res.redirect(`/contact/${result.name}`);
    } catch (error) {
      res.redirect(`/contact/${req.params.nameId}`);
    }
  })





//PATCH edit satu kontak
signedIn.get('/contacts', verifySignIn, async (req, res) => {
  let { sort, filter, page } = req.query;
  try {
    //cek page int valid bukan
    page = parseInt(page);
    if (page !== 0 && isNaN(page)) {
      return res.redirect('/contacts?page=0');
    };

    //tentukan page yang tersedia 
    let contacts = req.user.sortContactsBy(sort);
    const contactLength = contacts.length;
    let totalPage = parseInt((contactLength - 1) / contactsPerPage);
    if (contacts.length < 10) {
      totalPage = 0;
    };
    const result = pageContact(page, contacts);


    res.render("contacts", {
      ...layout,
      title: "Contact List",
      totalPage,
      page,
      theme: req.theme,
      result,
      sort
    });
  } catch (error) {
    res.json(error);
  }
});


const isStringIncludes = (what = '') => string => `${string}`.toLowerCase().includes(what.toLowerCase());
const excecptedField = ['_id', 'favorite', 'priority', 'updatedAt', 'createdAt'];
signedIn.get('/search', (req, res, next) => {
  let { q, page } = req.query;
  try {
    if (page === undefined) {
      page = 0
    }
    page = parseInt(page);
    if (page !== 0 && isNaN(page)) {
      return res.redirect('/search?q=&page=0');
    };
    const contacts = req.user.toJSON().contacts;
    const result = contacts.filter(contact => {

      return Object.keys(contact).filter(key => !excecptedField.includes(key)).some(isStringIncludes(q)) || Object.values(contact).some(isStringIncludes(q));
    });
    let resultLength = result.length;
    let totalPage = parseInt((resultLength - 1) / contactsPerPage);
    res.render("search", {
      ...layout,
      q,
      title: "Contact List",
      totalPage,
      page,
      theme: req.theme,
      result,
    });
  } catch (error) {
    next(error)
  }
});



const validatePassword = [
  verifySignIn,
  body('password-old', 'old password invalid!').isLength({ 'min': 8, 'max': 999 }).isString().trim(),
  body('password-new', 'new password invalid!').isLength({ 'min': 8, 'max': 999 }).isString().trim(),
  body('password-new-confirmation', 'new password invalid!').custom((value, { req }) => {
    return value === req.body['password-new']
  }).withMessage('new password and the confirmation dosnot match!').trim()
];
signedIn.route('/password')
  .get(verifySignIn, (req, res) => {
    let info = req.flash('info');
    let error = req.flash('error');
    res.render("password", {
      ...layout,
      title: "Password",
      info,
      error,
      theme: req.theme,
    });
  })
  .patch(validatePassword, async (req, res) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        throw result.array()[0]?.msg || 'invalid input!';
      }
      const auth = await bcrypt.compare(req.body["password-old"], req.user.password);
      if (auth === false) {
        req.flash('error', 'invalid authentication! wrong password!');
        return res.redirect('/password');
      }
      const newPasword = await bcrypt.hash(req.body['password-new'], 10);
      await req.user.changePassword(newPasword);
      req.flash('info', 'succes to change password');
      res.redirect('/password');
    } catch (error) {
      console.log(error);
      req.flash('error', error.message || error || 'change password error!');
      res.redirect('/password');
    }
  });


const validateEmail = [
  verifySignIn,
  body('email-old', ' invalid email format!').isEmail().isLength({ 'min': 3, 'max': 999 }).isString().trim(),
  body('email-new', 'invalid email format!').isEmail().isLength({ 'min': 3, 'max': 999 }).isString().trim(),
  body('password', 'invalid password format!').isLength({ 'min': 8, 'max': 999 }).isString().trim(),
];
signedIn.route('/email')
  .get(verifySignIn, (req, res) => {
    let info = req.flash('info');
    let error = req.flash('error');
    res.render("email", {
      ...layout,
      title: "Email",
      info,
      error,
      theme: req.theme,
    });
  })
  .patch(validateEmail, async (req, res) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        throw result.array()[0]?.msg || 'invalid input!';
      }

      const authEmail = req.user.email === req.body['email-old'];
      if (authEmail === false) {
        req.flash('error', 'invalid authentication! invalid credential: email!');
        return res.redirect('/email');
      }

      const authPassword = await bcrypt.compare(req.body["password"], req.user.password);
      if (authPassword === false) {
        req.flash('error', 'invalid authentication! invalid credential: password!');
        return res.redirect('/email');
      }

      await req.user.changeEmail(req.body['email-new']);
      req.flash('info', 'succes to change email');
      res.redirect('/email');
    } catch (error) {
      req.flash('error', error.code === 11000 ? 'cannot use new email! email has been used!' : error.message || error || 'change email error!');
      res.redirect('/email');
    }
  });


import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from "multer";
import { randomUUID } from "node:crypto";

signedIn.get('/contacts/export', verifySignIn, async (req, res, next) => {
  try {
    req.headers.accept = 'application/json';
    const contacts = req.user?.contacts ?? [];
    const fileName = `${req.user?.email?.replaceAll('@', '')}.json`;
    const filePath = path.join(config.temp, fileName);
    await fsp.writeFile(filePath, JSON.stringify(contacts), 'utf8', { space: 2 });
    const size = (await fsp.stat(filePath)).size;
    res.set('Content-Length', `${size}`);
    res.attachment(fileName);
    res.contentType('application/json');

    res.sendFile(filePath, async (error) => {
      try {
        await fsp.unlink(filePath);
        console.log(`File deleted successfully: ${filePath}`);
      } catch (cleanupError) {
        console.error(`Error deleting file: ${filePath}`, cleanupError);
      }
      if (error) {
        return next(error);
      }
    });
  } catch (error) {
    next(error);
  }
})


// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: config.temp,
  'filename': (req, file, callback) => {
    const username = req.user?.email?.replaceAll('@', '-');
    const safeFilename = username ? `${username}-${Date.now()}.json` : `${file.originalname}-${Date.now()}.json`;
    callback(null, safeFilename);
  }
})
const uploadFile = multer({
  storage,
  limits: {
    fieldSize: 1024 * 1024 * 16, // 16MB
    files: 1, //  1 file 
    fields: 2, // Tidak mengizinkan field non-file
    parts: 4, //
  },
  fileFilter: (req, file, cb) => {
    const isJson = file.mimetype === 'application/json';
    const isJsonExt = path.extname(file.originalname).toLowerCase() === '.json';
    if (isJson && isJsonExt) {
      return cb(null, true); //termia file
    }
    return cb(new Error('invalid JSON file format!'), false); //error dan tolak file
  },
});

signedIn.route('/contacts/import')
  .get(verifySignIn, (req, res) => {
    let info = req.flash('info');
    let error = req.flash('error');
    res.render("import", {
      ...layout,
      title: "Import Contacts",
      info,
      error,
      theme: req.theme,
    });
  })
  .post(verifySignIn, uploadFile.single('file'), async (req, res, next) => {
    if (!req.file) {
      return res.status(400).send('JSON file must attached');
    }
    const { option } = req.body;
    let data;
    try {
      const jsonString = await fsp.readFile(req.file.path, 'utf-8');
      data = JSON.parse(jsonString);
      let result = null;
      if (option === 'overwrite') {
        result = await req.user?.importOverWrite?.(data);
      }
      if (option === 'merge') {
        result = await req.user?.importMerge?.(data);
      }
      req.flash('info', `succes imported ${result?.accepted?.length ?? 0} contatcs and ${result.declined?.length ?? 0} contact failed to import!`);
      // res.json({ message: 'File imported!', option, result });
      res.redirect('/contacts/import')
    } catch (error) {
      next(error);
    } finally {
      await fsp.unlink(req.file.path).catch(err => {
        console.error(`Gagal menghapus file sementara: ${req.file.path}`, err);
      });
    }
  });


signedIn.route('/user/reset')
  .get(verifySignIn, (req, res) => {
    let info = req.flash('info');
    let error = req.flash('error');
    res.render("reset", {
      ...layout,
      title: "Reset Contacts",
      info,
      error,
      theme: req.theme,
    });
  })
  .put(verifySignIn, async (req, res) => {
    const { sure } = req.body;
    if (!sure) {
      req.flash('error', "Failed to reset account! you does not check the sure checkbox!")
      return res.redirect('/user/reset');
    }
    try {
      await req.user.resetUser();
      req.flash('info', 'Succes reset account!')
      return res.redirect('/user/reset');
    } catch (error) {
      req.flash('error', "Failed to reset account! internal server erro!");
      return res.redirect('/user/reset');
    }
  });




export const root1 = express.Router();
const createOTPage = oneTimePageFactory(root1, 'get', '/info', { redirect: '/' });
signedIn.route('/user/delete')
  .get(verifySignIn, (req, res) => {
    let info = req.flash('info');
    let error = req.flash('error');
    res.render("delete", {
      ...layout,
      title: "Delete Account",
      info,
      error,
      theme: req.theme,
    });
  })
  .delete([verifySignIn,
    body('email', 'invalid email format!').isEmail().trim(),
    body('password', 'invalid password format!').isLength({ 'min': 8, 'max': 999 }).trim()
  ], async (req, res) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      req.flash('error', result.array()[0].msg);
      return res.redirect('/user/delete');
    }
    const user = req.user?.toJSON?.();
    const { sure, email, password } = req.body;
    if (email !== user.email) {
      req.flash('error', 'Failed to delete account! Wrong email!');
      return res.redirect('/user/delete');
    }
    if (await bcrypt.compare(password, user.password) === false) {
      req.flash('error', 'Failed to delete account! Wrong password!');
      return res.redirect('/user/delete');
    }
    if (!sure) {
      req.flash('error', "Failed to delete account! you does not check the sure checkbox!")
      return res.redirect('/user/delete');
    };
    try {
      const user = req.user;
      const uuid = randomUUID();
      const deleteUser = await User.deleteOne({ _id: user.id });
      console.log(deleteUser);
      req.flash('info', 'Succes delete account!');
      const result = createOTPage(uuid, (req, res, next) => {
        res.render('info', {
          ...layout,
          title: 'Account Deletion Info',
          theme: req.theme,
          ...user
        })
      });
      res.cookie('sign_in_token', '', { expires: 0 });
      return res.redirect(result);
    } catch (error) {
      console.log(error);
      req.flash('error', "Failed to delete account! internal server error!");
      return res.redirect('/user/delete');
    }
  });




export { signedIn, verifySignIn }
export default signedIn;


const formData = {
  "name": "papua",
  "priority": "23",
  "favorite": "yes",
  "field-0": "halo",
  "value-0": "hai",
  // "field-1": "israel",
  "value-1": "babi",
  "field-2": "field",
  // "value-2": "value"
}
function createContact({ name, priority = 0, favorite = "", ...fields }) {
  favorite = Boolean(favorite.length); //
  const contact = {
    name: name?.trim?.(), priority, favorite,
  };
  fields = Object.entries(fields);
  const fieldNames = [];
  const fieldValues = [];
  fields.forEach(([key, value]) => {
    if (!key.length || !value.length) return;
    if (!includeNumber(key)) return;

    const num = key.split('-')[1];
    if (key.includes('field-')) return fieldNames.push([num, value]);

    return fieldValues.push([num, value]);
  });

  for (const [num, fieldName] of fieldNames) {
    for (const [valueNum, fieldValue] of fieldValues) { //jika field dan value nomornya cocok
      if (valueNum.includes(num))
        contact[fieldName?.trim?.()] = fieldValue?.trim?.();
    }
  };
  return contact;
};








function includeNumber(str = '') {
  for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
    if (str.includes(number)) {
      return true
    }
  }
  return false
}



function pageContact(page = 0, contacts) {
  return contacts.slice(page * contactsPerPage, page * contactsPerPage + contactsPerPage);
};
import mongoose, { Mongoose, Schema } from 'mongoose';

const protectedKeys = ['_id', 'name', 'favorite', 'priority', 'createdAt', 'updatedAt'];
// const protectedKeys = ['_id', 'name', 'favorite', 'priority', 'createdAt', 'updatedAt'];
const ContactSchema = new Schema({
  name: {
    type: String,
  },
  favorite: {
    type: Boolean
  },
  priority: {
    type: Number,
    min: 0,
    max: 100
  }
}, { strict: false, timestamps: true });

const SettingsSchema = new Schema({
  theme: {
    type: String,
    enum: ['default', 'dark'],
    default: 'default',
  }
}, {
  _id: false,
  strict: false,
});

// UserSchema utama
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email required'],
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password required'],
      trim: true
    },
    contacts: {
      type: [ContactSchema],
      default: []
    },
    settings: {
      type: SettingsSchema,
      default: () => ({}) // default ambil dari SettingsSchema
    }
  },
  { timestamps: true }
);

UserSchema.methods.toggleTheme = async function () {
  this.settings.theme = this.settings.theme === 'default' ? 'dark' : 'default';
  return this.save();
};

UserSchema.methods.addContact = async function (newContact) {
  this.contacts.forEach(contact => {
    if (contact.name === newContact.name) {
      throw new Error(`contact name alredy used by other contact! use new another name for the contact!`);
    }
  });
  this.contacts.push(newContact);
  return await this.save();
};
UserSchema.methods.findContactByName = async function (name) {
  for (const contact of this.contacts) {
    if (contact.name === name) {
      return contact.toJSON()
    }
  }
  return null
};
UserSchema.methods.toggleFavorite = async function (name) {
  for (const contact of this.contacts) {
    if (contact.name === name) {
      contact.favorite = contact.favorite ? false : true;
      return this.save();
    }
  }
  return null
};


UserSchema.methods.sortContactsBy = function (criteria = 'newest') {
  const contacts = [...this.contacts];
  switch (criteria) {
    case 'newest':
      return contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); //
    case 'oldest':
      return contacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); //
    case 'name-asc':
      return contacts.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // 
    case 'name-desc':
      return contacts.sort((a, b) => (b.name || '').localeCompare(a.name || '')); //
    case 'updated-newest':
      return contacts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); //
    case 'updated-oldest':
      return contacts.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)); //
    case 'favorite-first':
      return contacts.sort((a, b) => (b.favorite === true) - (a.favorite === true)); //
    case 'priority-high':
      return contacts.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // b - a kalau minus b kiri kanan a
    case 'priority-low':
      return contacts.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)); // a - b kalau minus a kiri kanan b
    default:
      return contacts;
  }
};



UserSchema.methods.patchContact = async function (id, formData) {
  // 1. Cari contact berdasarkan _id
  const contact = this.contacts.id(id);
  if (!contact) {
    throw new Error('Contact not found.');
  }

  // 2. Cek apakah nama bentrok (kalau name disertakan dalam update)
  if (formData.name) {
    const isDuplicate = this.contacts.some(c =>
      c._id.toString() !== id.toString() &&
      c.name === formData.name
    );
    if (isDuplicate) {
      throw new Error('Contact name already used by another contact! Use another name.');
    }
  };

  // 3. Update semua field dari formData ke contact (kecuali _id);
  // Kunci tetap yang tidak boleh dihapus

  // Hapus field dinamis lama (selain yang dilindungi)
  for (const key of Object.keys(contact.toObject())) {
    if (!protectedKeys.includes(key)) {
      contact.set(key, undefined, { strict: false }); // cara aman hapus field di Mongoose
    }
  }

  // Update field dari formData
  for (const key in formData) {
    if (key === '_id') continue;

    let value = formData[key];

    // Tangani parsing khusus
    if (key === 'priority') {
      const parsed = parseInt(value);
      if (!isNaN(parsed)) value = parsed;
    }

    if (key === 'favorite') {
      value = Boolean(value);
    }

    contact.set(key, value, { strict: false }); // masukkan data ke contact
  }

  // 4. Simpan perubahan
  await this.save();
  return contact.toJSON();
};

UserSchema.methods.deleteContactByName = async function (name) {
  this.contacts = this.contacts.filter(contact => contact.name !== name);
  await this.save();
  return true;
};

UserSchema.methods.changePassword = async function (password) {
  this.password = password;
  return await this.save();
}

UserSchema.methods.changeEmail = async function (email) {
  this.email = email;
  return await this.save();
}

UserSchema.methods.importOverWrite = async function (contacts = []) {
  let accepted = [];
  let declined = [];
  if (contacts.length <= 0) return false;
  contacts.forEach(contact => {
    contact.name = contact.name?.trim?.();
    const sanitized = sanitizeContact(contact);
    if (sanitized === false) return declined.push(contact);
    if (accepted.some(c => c.name === contact.name || c._id === contact._id) === true) return declined.push(contact);
    return accepted.push(contact);
  });
  this.contacts = accepted;
  await this.save();
  return {
    accepted, declined
  }
};


UserSchema.methods.importMerge = async function (contacts = []) {
  let sanitized = [];
  let declined = [];
  let accepted = [];
  if (contacts.length <= 0) return false;
  //sanitasi tiap kontak import
  contacts.forEach(contact => {
    contact.name = contact.name?.trim?.();

    const steril = sanitizeContact(contact);
    if (steril === false) return declined.push(contact);
    return sanitized.push(steril);
  });


  const contactsBefore = this.toJSON()?.contacts;
  //JIKA SYDAH ADA ISIS nYA
  contactsBefore?.forEach?.((contact, i) => {
    sanitized.forEach((imported, j) => {

      if (imported.name === contact.name || imported._id === contact._id) { //gabung dulu field dinamisnya jika ada yang sama nama atau id nya
        const { _id, name, priority, favorite, createdAt, updatedAt, ...fields } = imported;
        const merged = { ...contact, ...fields };

        const index = accepted.findIndex(c => c.name === merged.name || c._id === merged._id); //cari jika sudah ter accepct di bawah
        if (index !== -1) { //jika index maka merge lagi timpa 
          const mergedAgain = { ...accepted[index], ...merged };
          return accepted[index] = mergedAgain;
        };

        if (accepted.some(c => c.name === merged.name || c._id === merged._id) === false) {
          accepted.push(merged);
          return  //jika tidak ya push yang merged
        }


      };

      //jika tidak sama nama ataua id nya
      if (accepted.some(c => c.name === contact.name || c._id === contact._id) === false) {
        return accepted.push(contact);
      }

      if (accepted.some(c => c.name === imported.name || c._id === imported._id) === false) {
        return accepted.push(imported);
      }

    });
  });


  //  PENTING : jika contactSekarang atau beore tidak ada isinya
  if (contactsBefore?.length === 0) {
    sanitized.forEach((imported, j) => {

      const index = accepted.findIndex(c => c.name === imported.name || c._id === imported._id);
      if (index !== -1) { //jika index 
        const merged = { ...accepted[index], ...imported };
        return accepted[index] = merged;
      };

      if (accepted.some(c => c.name === imported.name || c._id === imported._id) === false) {
        return accepted.push(imported);
      }

    });
  };
  //anjay seesai
  this.contacts = accepted;
  await this.save();

  return {
    before: this.toJSON()?.contacts,
    contacts,
    accepted, declined
  }
}



UserSchema.methods.resetUser = async function () {
  this.contacts = [];
  return await this.save();
}

const User = mongoose.model('User', UserSchema);
export default User;



function validateAllProtectedKeys({ _id, name, priority, favorite, createdAt, updatedAt }) {
  if (!mongoose.isValidObjectId(_id)) return false;
  if (typeof name !== 'string') return false;
  if ((new Date(createdAt)).toString() === 'Invalid Date') return false;
  if ((new Date(updatedAt)).toString() === 'Invalid Date') return false;
  if (typeof favorite !== 'boolean') return false;
  if (typeof priority !== 'number') return false;
  if (priority < 0 || priority > 100) return false;
  return true
};

function sanitizeContact({ _id, name, priority, favorite, createdAt, updatedAt, ...dynamics }) {
  if (validateAllProtectedKeys({ _id, name, priority, favorite, createdAt, updatedAt }) === false) return false;
  const contact = {
    _id, name: name.trim(), priority, favorite, createdAt, updatedAt
  };
  for (const field in dynamics) {
    const value = dynamics[field];
    if (typeof value === 'string') contact[field] = value.trim();
  }
  return contact;
}
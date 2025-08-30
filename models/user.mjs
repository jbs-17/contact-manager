import mongoose, { Schema } from 'mongoose';


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


const protectedKeys = ['_id', 'name', 'favorite', 'priority', 'createdAt', 'updatedAt'];
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

const User = mongoose.model('User', UserSchema);
export default User;

const u = new User();

import path from 'node:path';
const dirname = import.meta.dirname;
const etc = {
  dirname,
  APP_NAME: 'Contact Manager',
  temp: "/tmp"
}
const config = {
  ...etc,
  layout: {
    ...etc,
    layout: "./layouts/layout.ejs",
    msg: {},
    script: null,
    error: [],
    theme: "light"
  },
};
export default Object.freeze(config);
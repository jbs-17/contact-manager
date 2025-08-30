import { config as c} from "dotenv";
c();


const etc = {
  APP_NAME: 'Contact Manager',
}
const config = {
  ...etc,
  layout: {
    ...etc,
    layout: "./layouts/layout.ejs",
    msg: {},
    script: null,
    error: [],
    theme:"light"
  },
};
export default Object.freeze(config);
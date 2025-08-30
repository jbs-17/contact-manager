import * as bcrypt from 'bcrypt';
const a = '$2b$10$oKs/cs8HgEpsAQ2/92hPHetC.K2yEWV8RmFJ6SuqUjk437LTOF2im'


console.log(await bcrypt.compare('passworda ', a));
import { initPg, createTables } from './db';

module.exports = async () => {
  const clientPg = await initPg();
  await createTables(clientPg, true);
  await clientPg.query(`insert into account_test (userid, username, email, password, salt)\
\ \ values ('7f65f6a4f4b1c5f7', 'foobar', 'foobar@example.com',\
\ \ 'a58be3b25377434441df1e00303c666d8575797032af470f054945dea138ce6a', 'd0a7fbb7ce83eaba768cd464d7cb55e9')`);
  await clientPg.query(`insert into folder_test (folderid, userid, name) values ('2b9d34170d53c39a', '7f65f6a4f4b1c5f7', 'existingfolder')`);
}

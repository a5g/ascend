'use strict';
const bcrypt = require('bcryptjs'); // Would need bcrypt or similar in actual app, using a dummy hash here for phase 1

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('users', [{
      email: 'superadmin@ascend.com',
      password_hash: 'dummy_hash_to_be_replaced',
      role: 'super_admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', { email: 'superadmin@ascend.com' }, {});
  }
};

import { Sequelize, DataTypes, Model } from 'sequelize';

const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'ascend_db',
  process.env.POSTGRES_USER || 'ascend',
  process.env.POSTGRES_PASSWORD || 'ascend_password',
  {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    dialect: 'postgres',
  }
);

class User extends Model {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public role!: string;
  public zerodha_access_token!: string | null;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    zerodha_access_token: {
        type: DataTypes.STRING,
        allowNull: true,
    }
  },
  {
    sequelize,
    tableName: 'users',
  }
);

class PositionSizingConfig extends Model {
  public id!: number;
  public userId!: number;
  public configName!: string;
  public strategy!: string;
  public parameters!: object;
}

PositionSizingConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    configName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    strategy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parameters: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'position_sizing_configs',
  }
);

export { sequelize, User, PositionSizingConfig };
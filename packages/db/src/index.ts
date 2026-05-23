import { Sequelize, DataTypes, Model } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME || process.env.POSTGRES_DB || 'ascend',
  process.env.DB_USER || process.env.POSTGRES_USER || 'anand',
  process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    dialect: 'postgres',
  }
);

class User extends Model {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public role!: string;
  public name!: string | null;
  public kite_id!: string | null;
  public capital!: number | null;
  public is_active!: boolean;
  public access_token!: string | null;
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
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    kite_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    capital: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    access_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zerodha_access_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
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

class Alert extends Model {
  public id!: number;
  public user_id!: number;
  public symbol!: string;
  public condition!: string;
  public threshold!: number | null;
  public reference_price!: number | null;
  public channels!: object;
  public active!: boolean;
  public triggered_at!: Date | null;
}

Alert.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    threshold: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    reference_price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    channels: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    triggered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'alerts',
  }
);

class Notification extends Model {
  public id!: number;
  public user_id!: number;
  public alert_id!: number | null;
  public message!: string;
  public is_read!: boolean;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    alert_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
  }
);

export { sequelize, User, PositionSizingConfig, Alert, Notification };

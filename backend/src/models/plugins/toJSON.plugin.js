const { get } = require('lodash');
const { Types } = require('mongoose');

const toJSON = (schema) => {
  let transform;
  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  schema.options.toJSON = Object.assign(schema.options.toJSON || {}, {
    transform(doc, ret, options) {
      // Remove the _id and __v fields
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;

      // Convert ObjectId to string
      Object.keys(ret).forEach((key) => {
        if (ret[key] instanceof Types.ObjectId) {
          ret[key] = ret[key].toString();
        } else if (Array.isArray(ret[key])) {
          ret[key] = ret[key].map((item) => {
            if (item instanceof Types.ObjectId) {
              return item.toString();
            }
            return item;
          });
        } else if (ret[key] instanceof Map) {
          ret[key] = Object.fromEntries(ret[key]);
        }
      });

      // Apply custom transform if exists
      if (transform) {
        return transform(doc, ret, options);
      }

      return ret;
    },
  });
};

module.exports = toJSON;

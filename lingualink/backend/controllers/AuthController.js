const UserModel = require('../models/UserModel');

class AuthController {
  async login(req, res) {
    try {
      const { type_document, number_document, password } = req.body;

      if (!type_document || !number_document || !password) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son obligatorios'
        });
      }

      const user = await UserModel.findByCredentials(type_document, number_document, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales incorrectas'
        });
      }

      return res.json({
        success: true,
        message: 'Login exitoso',
        user
      });
    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({
        success: false,
        message: 'Error del servidor al iniciar sesión',
        detail: error.message
      });
    }
  }
}

module.exports = new AuthController();

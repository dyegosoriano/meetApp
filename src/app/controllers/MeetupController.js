import * as Yup from 'yup'
import { Op } from 'sequelize'
import { subDays, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns'

import User from '../models/User'
import Meetup from '../models/Meetup'
import File from '../models/File'

class MeetupController {
  async store (request, response, next) {
    const { banner_id, title, description, adress, date } = request.body

    // Validando campos de entrada com Yup
    const schema = Yup.object().shape({
      banner_id: Yup.number().required(),
      title: Yup.string().required(),
      description: Yup.string().required(),
      adress: Yup.string().required(),
      date: Yup.date().required()
    })

    // Tratamento de erro de validação do Yup
    if (!(await schema.isValid(request.body))) {
      return response
        .json({ error: 'Validations fails' })
        .status(400)
    }

    try {
      // Buscando id no banco de dados atraves do userId inserido pelo Middleware de autenticação
      const user = await User.findByPk(request.userId)

      // Verificando existência de banner no banco de dados
      if (!(await File.findByPk(banner_id))) {
        return response
          .json({ error: 'File not found' })
          .status(400)
      }

      // Cadastrando Meetup
      await Meetup.create({
        user_id: user.id,
        banner_id,
        title,
        description,
        adress,
        date
      })

      return response.json({ message: 'The meetup was created' })
    } catch (error) {
      next(error)
    }
  }

  async update (request, response, next) {
    const { id } = request.params
    const { banner_id, title, description, adress, date } = request.body

    try {
      // Buscando id no banco de dados atraves do userId inserido pelo Middleware de autenticação
      const user = await User.findByPk(request.userId)

      // Verificando existência de Meetup
      const meetup = await Meetup.findByPk(id)
      if (!meetup) {
        return response
          .json({ error: 'Meetup does not exist' })
          .status(400)
      }

      // Validando permissão de usuário
      if (user.id !== meetup.user_id) {
        return response
          .json({ error: 'User does not autorised' })
          .status(401)
      }

      // Verificando existência de Meetup
      const banner = await File.findByPk(banner_id)
      if (!banner) {
        return response
          .json({ error: 'Banner does not exist' })
          .status(400)
      }

      await meetup.update({
        banner_id,
        title,
        description,
        adress,
        date
      })

      return response.json({ message: 'The meetup has been updated' })
    } catch (error) {
      next(error)
    }
  }

  async index (request, response, next) {
    const { page = 1, date } = request.query

    const parsedDate = parseISO(date)
    const startDay = startOfDay(parsedDate)
    const endDay = endOfDay(parsedDate)

    try {
      const meetups = await Meetup.findAll({
        where: {
          canceled_at: null,
          date: { [Op.between]: [startDay, endDay] }
        },
        order: ['date'],
        limit: 20,
        offset: (page - 1) * 20,
        attributes: ['id', 'date', 'description', 'adress'],
        include: [
          {
            model: File,
            as: 'banner',
            attributes: ['url', 'name']
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'name']
          }
        ]
      })

      return response.json(meetups)
    } catch (error) {
      next(error)
    }
  }

  async show (request, response, next) {
    try {
      const { id } = request.params
      const meetup = await Meetup.findByPk(id)

      return response.json(meetup)
    } catch (error) {
      next(error)
    }
  }

  async delete (request, response, next) {
    try {
      // Buscando id no banco de dados atraves do userId inserido pelo Middleware de autenticação
      const user = await User.findByPk(request.userId)

      // Verificando existência de Meetup e autorização de usuário
      const meetup = await Meetup.findByPk(request.params.id)

      if (!meetup) {
        return response
          .json({ error: 'Meetup does not exist' })
          .status(400)
      }

      if (meetup.canceled_at) {
        return response
          .json({ error: 'This meetapp was already canceled!' })
          .status(400)
      }

      if (user.id !== meetup.user_id) {
        return response
          .json({ error: 'User does not autorised' })
          .status(401)
      }

      // Regra que impossibilita o cancelamento do agendamento com limite de 3 dias antes
      const dateWithSub = subDays(meetup.date, 3)

      if (isBefore(dateWithSub, new Date())) {
        return response
          .json({ error: 'You can only cancel appointments 3 days in advance.' })
          .status(401)
      }

      // Adicionando data e horario de cancelamento
      meetup.canceled_at = new Date()
      await meetup.save()

      return response.json(meetup)
    } catch (error) {
      next(error)
    }
  }
}

export default new MeetupController()

import { prisma } from "../../config/prisma";

export class PaymentRepository{
    static async getAllPayments(){
        const payments = await prisma.payment.findMany({
            select: {
              id: true,
              amount: true,
              status: true,
              provider: true,
              createdAt: true,

                user:{
                select:{
                    name:true,
                    email:true,

                }},
              booking: {
                select: {
                  status: true,
                  showtime: {
                    select: {
                      startTime: true,
                      movie: {
                        select: {
                          title: true,
                          posterUrl: true,
                        },
                      },

                      screen: {
                        select: {
                          theater: {
                            select: {
                              name: true,
                              city: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy:{
              createdAt:'desc'
            }
          });
        
          return payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            status: p.status,
            provider: p.provider,
            createdAt: p.createdAt,
        
            movieTitle: p.booking.showtime.movie.title,
            posterUrl: p.booking.showtime.movie.posterUrl,

            username: p.user.name,
            userEmail: p.user.email,
        
            showtime: p.booking.showtime.startTime,
            theaterName: p.booking.showtime.screen.theater.name,
            city: p.booking.showtime.screen.theater.city,
        
            bookingStatus: p.booking.status,
          }));
    }

    static async getPaymentsByID(paymentId:string){
        return await prisma.payment.findUnique({
            where:{id:paymentId},
            include:{
                booking:{
                    include:{
                        user:true,
                        showtime:{
                            include:{
                                movie:true,
                                screen:{
                                    include:{
                                        theater:true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}
import { prisma } from '@/lib/prisma'
export async function getTrainerConfig() {
  let config = await prisma.trainerConfig.findFirst()
  if (!config) {
    config = await prisma.trainerConfig.create({
      data: {
        name: 'Fernando García',
        location: 'Padel Club Ibiza',
        priceSingle: 65,
        pricePackage5: 300,
        pricePackage10: 550,
        availabilityJson: JSON.stringify({ mo:'09:00-19:00',tu:'09:00-19:00',we:'09:00-19:00',th:'09:00-19:00',fr:'09:00-19:00',sa:'10:00-14:00',su:null }),
        language: 'de',
        calendarId: 'primary',
      },
    })
  }
  return config
}

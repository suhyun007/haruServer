import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.create({
    data: {
      id: 'user1',
      name: '테스트 사용자',
      targetWeight: 65.0,
      currentWeight: 70.0,
      dailyCalorieGoal: 2000,
    },
  })

  console.log('Created user:', user)

  // Add some sample meals
  await prisma.meal.createMany({
    data: [
      {
        userId: 'user1',
        mealType: '아침',
        foodName: '계란 프라이',
        calories: 200,
        date: new Date(),
      },
      {
        userId: 'user1',
        mealType: '점심',
        foodName: '닭가슴살 샐러드',
        calories: 350,
        date: new Date(),
      },
    ],
  })

  // Add sample weight record
  await prisma.weight.create({
    data: {
      userId: 'user1',
      weight: 70.0,
      date: new Date(),
    },
  })

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


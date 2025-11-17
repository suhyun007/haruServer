import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type MealItem = {
  calories?: number | null;
  carbs?: number | null;
  protein?: number | null;
  fat?: number | null;
  count?: number | null;
  servings?: number | null;
  [key: string]: any;
};

type MealRow = {
  id: string;
  user_id?: string | null;
  diary_id?: string | null;
  meal_key: string;
  date: string | null;
  items: MealItem[] | null;
  total_calories: number | null;
  total_carbs: number | null;
  total_protein: number | null;
  total_fat: number | null;
};

const MEAL_KEYS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function calculateTotals(items: MealItem[] = []) {
  return items.reduce(
    (acc, item) => {
      const calories = Number(item.calories ?? 0);
      const carbs = Number(item.carbs ?? 0);
      const protein = Number(item.protein ?? 0);
      const fat = Number(item.fat ?? 0);

      acc.calories = (acc.calories ?? 0) + calories;
      acc.carbs = (acc.carbs ?? 0) + carbs;
      acc.protein = (acc.protein ?? 0) + protein;
      acc.fat = (acc.fat ?? 0) + fat;

      return acc;
    },
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
}

function normaliseDate(date: string) {
  // 이미 YYYY-MM-DD 형식이므로 그대로 반환
  // 타임존 변환으로 인한 날짜 변경 방지
  return date;
}

function serialiseMeal(row: MealRow | null) {
  if (!row) return null;
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    items,
    totalCalories: Number(row.total_calories ?? 0),
    totalCarbs: Number(row.total_carbs ?? 0),
    totalProtein: Number(row.total_protein ?? 0),
    totalFat: Number(row.total_fat ?? 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const date = searchParams.get("date");

    if (!userId || !date) {
      return NextResponse.json(
        { error: "userId and date are required" },
        { status: 400 },
      );
    }

    const normalisedDate = normaliseDate(date);
    console.log(`📥 GET /meal-calories: userId=${userId}, date=${date}, normalisedDate=${normalisedDate}`);

    // date 컬럼을 사용하여 직접 날짜별 조회
    const { data: mealsData, error: mealError } = await supabase
      .from("meal_calories")
      .select("*")
      .eq("user_id", userId)
      .eq("date", normalisedDate);
    
    if (mealError) {
      console.error("❌ Error fetching meal calories:", mealError);
      return NextResponse.json(
        { error: "Failed to load meal calories" },
        { status: 500 },
      );
    }
    
    const meals = (mealsData as MealRow[]) ?? [];
    console.log(`📥 Found ${meals.length} meal entries for date=${normalisedDate}`);
    meals.forEach((meal) => {
      console.log(`  - ${meal.meal_key}: ${meal.items?.length || 0} items, ${meal.total_calories} kcal`);
    });

    const response: Record<string, ReturnType<typeof serialiseMeal>> = {};
    const totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };

    (meals ?? []).forEach((row) => {
      const serialised = serialiseMeal(row as MealRow);
      if (!serialised) return;
      response[(row as MealRow).meal_key] = serialised;
      totals.calories += serialised.totalCalories;
      totals.carbs += serialised.totalCarbs;
      totals.protein += serialised.totalProtein;
      totals.fat += serialised.totalFat;
    });

    console.log(`📥 Response: ${Object.keys(response).length} meals, totals: ${JSON.stringify(totals)}`);
    return NextResponse.json({ meals: response, totals });
  } catch (error) {
    console.error("Unexpected error in GET /meal-calories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date, mealKey, items } = body;

    if (!userId || !date || !mealKey) {
      return NextResponse.json(
        { error: "userId, date and mealKey are required" },
        { status: 400 },
      );
    }

    if (!MEAL_KEYS.has(mealKey)) {
      return NextResponse.json({ error: "Invalid meal key" }, { status: 400 });
    }

    const itemList: MealItem[] = Array.isArray(items) ? items : [];
    const totals = calculateTotals(itemList);

    const normalisedDate = normaliseDate(date);
    console.log(`💾 POST /meal-calories: userId=${userId}, date=${date}, normalisedDate=${normalisedDate}, mealKey=${mealKey}, items=${itemList.length}`);

    // Check if user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from("haru_users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userCheckError) {
      console.error("❌ Error checking user existence:", userCheckError);
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 },
      );
    }

    if (!existingUser) {
      console.error(`❌ User not found: ${userId}`);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // 이미 해당 날짜에 다이어리가 있는지 확인 (있으면 meal과 연결만 해줌)
    const { data: existingDiary, error: diaryFetchError } = await supabase
      .from("haru_diary")
      .select("id")
      .eq("user_id", userId)
      .eq("date", normalisedDate)
      .maybeSingle();

    if (diaryFetchError) {
      console.error("❌ Error fetching diary before meal save:", diaryFetchError);
      return NextResponse.json(
        { error: "Failed to prepare diary" },
        { status: 500 },
      );
    }

    // 다이어리가 이미 있는 경우에만 diary_id로 연결 (없으면 null 유지)
    const diaryId = existingDiary?.id as string | undefined;
    console.log(`💾 Existing diary for meal linkage: ${diaryId ? `id=${diaryId}` : 'none (meal will not create diary)'}`);

    // If no items, delete existing meal entry
    if (itemList.length === 0) {
      const { error: deleteError } = await supabase
        .from("meal_calories")
        .delete()
        .eq("user_id", userId)
        .eq("date", normalisedDate)
        .eq("meal_key", mealKey);

      if (deleteError) {
        console.error("Error deleting meal calories:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete meal" },
          { status: 500 },
        );
      }

      return NextResponse.json({ meal: null });
    }

    const { data: existingMeal, error: existingMealError } = await supabase
      .from("meal_calories")
      .select("id, items")
      .eq("user_id", userId)
      .eq("date", normalisedDate)
      .eq("meal_key", mealKey)
      .maybeSingle();

    if (existingMealError) {
      console.error("Error checking existing meal:", existingMealError);
      return NextResponse.json(
        { error: "Failed to save meal" },
        { status: 500 },
      );
    }

    let savedMeal: MealRow | null = null;

    if (existingMeal) {
      console.log(`💾 Updating existing meal: id=${existingMeal.id}, diary_id=${diaryId}`);
      
      // 기존 items와 새로운 items 합치기
      const existingItems = Array.isArray(existingMeal.items) 
        ? (existingMeal.items as MealItem[])
        : [];
      const mergedItems = [...existingItems, ...itemList];
      const mergedTotals = calculateTotals(mergedItems);
      
      console.log(`💾 Merging items: existing=${existingItems.length}, new=${itemList.length}, merged=${mergedItems.length}`);
      
      const { data, error } = await supabase
        .from("meal_calories")
        .update({
          date: normalisedDate,
          items: mergedItems,
          total_calories: mergedTotals.calories,
          total_carbs: mergedTotals.carbs,
          total_protein: mergedTotals.protein,
          total_fat: mergedTotals.fat,
        })
        .eq("id", existingMeal.id)
        .select("*")
        .single();

      if (error) {
        console.error("❌ Error updating meal calories:", error);
        return NextResponse.json(
          { error: "Failed to update meal" },
          { status: 500 },
        );
      }

      savedMeal = data as MealRow;
      console.log(`💾 Updated meal: id=${savedMeal.id}, diary_id=${savedMeal.diary_id}, meal_key=${savedMeal.meal_key}`);
    } else {
      console.log(`💾 Inserting new meal: diary_id=${diaryId}, date=${normalisedDate}, meal_key=${mealKey}`);
      const { data, error } = await supabase
        .from("meal_calories")
        .insert({
          user_id: userId,
          diary_id: diaryId,
          date: normalisedDate,
          meal_key: mealKey,
          items: itemList,
          total_calories: totals.calories,
          total_carbs: totals.carbs,
          total_protein: totals.protein,
          total_fat: totals.fat,
        })
        .select("*")
        .single();

      if (error) {
        console.error("❌ Error inserting meal calories:", error);
        return NextResponse.json(
          { error: "Failed to save meal" },
          { status: 500 },
        );
      }

      savedMeal = data as MealRow;
      console.log(`💾 Inserted meal: id=${savedMeal.id}, diary_id=${savedMeal.diary_id}, meal_key=${savedMeal.meal_key}`);
    }

    const serialised = serialiseMeal(savedMeal);
    console.log(`💾 Returning meal: ${JSON.stringify(serialised)}`);
    return NextResponse.json({ meal: serialised });
  } catch (error) {
    console.error("Unexpected error in POST /meal-calories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId;
    const date = body.date;
    const mealKey = body.mealKey;

    if (!userId || !date || !mealKey) {
      return NextResponse.json(
        { error: "userId, date, and mealKey are required" },
        { status: 400 },
      );
    }

    if (!MEAL_KEYS.has(mealKey)) {
      return NextResponse.json(
        { error: `Invalid mealKey: ${mealKey}` },
        { status: 400 },
      );
    }

    const normalisedDate = normaliseDate(date);
    console.log(`🗑️ DELETE /meal-calories: userId=${userId}, date=${date}, normalisedDate=${normalisedDate}, mealKey=${mealKey}`);

    // 사용자 존재 확인
    const { data: user, error: userError } = await supabase
      .from("haru_users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Error checking user:", userError);
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 },
      );
    }

    if (!user) {
      console.error(`User not found: ${userId}`);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // meal_calories 삭제
    const { error: deleteError } = await supabase
      .from("meal_calories")
      .delete()
      .eq("user_id", userId)
      .eq("date", normalisedDate)
      .eq("meal_key", mealKey);

    if (deleteError) {
      console.error("❌ Error deleting meal calories:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete meal" },
        { status: 500 },
      );
    }

    console.log(`🗑️ Deleted meal: userId=${userId}, date=${normalisedDate}, mealKey=${mealKey}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /meal-calories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
